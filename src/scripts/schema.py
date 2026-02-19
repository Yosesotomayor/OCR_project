from pyspark.sql.types import StructType, StructField, StringType, FloatType, ArrayType

OCR_RESULT_SCHEMA = StructType([
    StructField("raw_text", StringType(), True),
    StructField("amounts", ArrayType(FloatType()), True),
    StructField("max_amount", FloatType(), True),
    StructField("postal_code", StringType(), True),
    StructField("possible_name", StringType(), True),
    StructField("status", StringType(), True)
])