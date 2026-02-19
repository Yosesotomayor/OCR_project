import os
from pyspark.sql import SparkSession
from pyspark.sql.functions import udf, col

from src.scripts.schema import OCR_RESULT_SCHEMA
from src.scripts.ocr_engine import OCREngine
from src.scripts.parser import DataParser

DB_USER = os.getenv("DB_USER", "yose")
DB_PASSWORD = os.getenv("DB_PASSWORD", "mifel_password")
DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "ocr_db")
JDBC_DRIVER = os.getenv("SPARK_JDBC_DRIVER_PATH", "/app/drivers/postgresql-42.7.2.jar")
JDBC_URL = f"jdbc:postgresql://{DB_HOST}:5432/{DB_NAME}"

def process_image_pipeline(image_path: str):
    ocr = OCREngine()
    parser = DataParser()
    raw_text = ocr.extract_text(image_path)
    structured_data = parser.parse(raw_text)
    
    return structured_data

def main():
    print("Iniciando Pipeline Distribuido de OCR...")
    
    spark = SparkSession.builder \
        .appName("Mifel-OCR-ETL") \
        .config("spark.jars", JDBC_DRIVER) \
        .config("spark.driver.extraClassPath", JDBC_DRIVER) \
        .getOrCreate()
    ocr_udf = udf(process_image_pipeline, OCR_RESULT_SCHEMA)
    image_paths = [
        ("data/test_ine_1.jpg",),
        ("data/test_state_account.jpg",)
    ]
    df_input = spark.createDataFrame(image_paths, ["file_path"])

    print("Ejecutando OCR en paralelo...")
    df_processed = df_input.withColumn("ocr_data", ocr_udf(col("file_path")))

    df_final = df_processed.select(
        col("file_path"),
        col("ocr_data.possible_name").alias("nombre_detectado"),
        col("ocr_data.max_amount").alias("monto_pagar"),
        col("ocr_data.postal_code").alias("cp"),
        col("ocr_data.status").alias("estado_proceso")
    )

    df_final.show(truncate=False)
    print(f"Guardando en PostgreSQL: {JDBC_URL}")
    
    properties = {
        "user": DB_USER,
        "password": DB_PASSWORD,
        "driver": "org.postgresql.Driver"
    }
    df_final.write.jdbc(url=JDBC_URL, table="public.ocr_results", mode="append", properties=properties)
    
    print("Carga finalizada.")
    spark.stop()

if __name__ == "__main__":
    main()