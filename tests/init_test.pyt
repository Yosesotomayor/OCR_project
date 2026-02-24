# file to test conection to mongodb and postgres with spark
from pyspark.sql import SparkSession

def test_mongodb_connection():
      spark = SparkSession.builder \
        .appName("MongoDBTest") \
        .config("spark.mongodb.input.uri", "mongodb://admin:password@vector-db:27017/ocr_db") \
        .config("spark.mongodb.output.uri", "mongodb://admin:password@vector-db:27017/ocr_db") \
        .getOrCreate()
      df = spark.read.format("com.mongodb.spark.sql.DefaultSource").load()
      df.show()
      spark.stop()      

def test_postgres_connection():
      spark = SparkSession.builder \
        .appName("PostgresTest") \
        .config("spark.jars", "/app/drivers/postgresql-42.7.2.jar") \
        .getOrCreate()

      df = spark.read.format("jdbc") \
        .option("url", "jdbc:postgresql://vector-db:5432/ocr_db") \
        .option("driver", "org.postgresql.Driver") \
        .option("dbtable", "ocr_table") \
        .load()
      df.show()
      spark.stop()

test_mongodb_connection()
test_postgres_connection()