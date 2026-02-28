import stripe
import os
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from .infrastructure.database import get_db
from .models import User

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, stripe_webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail=str(e))

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        client_reference_id = session.get('client_reference_id') # Our internal user ID

        if client_reference_id:
            user = db.query(User).filter(User.id == client_reference_id).first()
            if user:
                user.stripe_customer_id = customer_id
                user.stripe_subscription_id = subscription_id
                user.subscription_status = "active"
                
                # Fetch subscription details to get price_id and current_period_end
                if subscription_id:
                    subscription = stripe.Subscription.retrieve(subscription_id)
                    if subscription and subscription.items.data:
                        user.stripe_price_id = subscription.items.data[0].price.id
                        # Calculate subscription_end_date
                        if subscription.current_period_end:
                            user.subscription_end_date = datetime.fromtimestamp(subscription.current_period_end).date()
                        
                        # Determine subscription_plan based on price_id (you'll need to map these)
                        # For now, a simple placeholder
                        user.subscription_plan = "Premium" # TODO: Map Stripe Price ID to your internal plan names

                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"User {user.email} updated with subscription details.")
            else:
                print(f"User with client_reference_id {client_reference_id} not found.")

    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        customer_id = subscription.get('customer')

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.stripe_subscription_id = subscription.id
            user.subscription_status = subscription.status
            if subscription.current_period_end:
                user.subscription_end_date = datetime.fromtimestamp(subscription.current_period_end).date()
            if subscription.items.data:
                user.stripe_price_id = subscription.items.data[0].price.id
                user.subscription_plan = "Premium" # TODO: Map Stripe Price ID to your internal plan names
            
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"User {user.email} subscription updated.")

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription.get('customer')

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.stripe_subscription_id = None
            user.stripe_price_id = None
            user.subscription_status = "canceled"
            user.subscription_plan = None
            user.subscription_end_date = None
            
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"User {user.email} subscription canceled.")

    return {"status": "success"}