# import pika
# import os
# import time
# import json

# # Get RabbitMQ connection URL from environment variable
# RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
# QUEUE_NAME = "password_reset_queue"

# def send_email_simulation(email: str, reset_link: str):
#     """
#     This function simulates sending an email.
#     In a real application, you would integrate a real email service
#     like SendGrid, Mailgun, or use Python's smtplib.
#     """
#     print("--------------------------------------------------")
#     print(f"SIMULATING EMAIL SEND")
#     print(f"TO: {email}")
#     print(f"SUBJECT: Your Password Reset Link")
#     print(f"BODY:")
#     print(f"  Hello,")
#     print(f"  You requested a password reset. Please click the link below to reset your password:")
#     print(f"  {reset_link}")
#     print(f"  This link will expire in 15 minutes.")
#     print("--------------------------------------------------")

# def callback(ch, method, properties, body):
#     """
#     This function is called whenever a message is received from the queue.
#     """
#     print(f" [WORKER] Received message from queue '{QUEUE_NAME}'")
#     try:
#         # Decode the message from bytes to a string, then parse the JSON
#         message = json.loads(body.decode('utf-8'))
#         email = message.get("email")
#         token = message.get("token")

#         if not email or not token:
#             print(" [WORKER] Message is malformed. Skipping.")
#         else:
#             # Construct the full reset link (the frontend URL)
#             reset_link = f"http://localhost:5173/reset-password?token={token}"
#             send_email_simulation(email, reset_link)
#             print(f" [WORKER] Email simulation complete for {email}.")

        
#         ch.basic_ack(delivery_tag=method.delivery_tag)
#         print(" [WORKER] Message acknowledged.")

#     except Exception as e:
#         print(f" [WORKER] Error processing message: {e}")
#         ch.basic_ack(delivery_tag=method.delivery_tag)

# def start_worker():
#     """
#     Starts the worker process to listen for messages on the RabbitMQ queue.
#     """
#     connection = None
#     # Retry connection to RabbitMQ in case it's not ready yet
#     for i in range(10): # Try 10 times
#         try:
#             print(" [WORKER] Connecting to RabbitMQ...")
#             connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
#             print(" [WORKER] Connection successful!")
#             break
#         except pika.exceptions.AMQPConnectionError:
#             print(f" [WORKER] Connection failed. Retrying in 5 seconds... (Attempt {i+1}/10)")
#             time.sleep(5)
    
#     if not connection:
#         print(" [WORKER] Could not connect to RabbitMQ after multiple attempts. Exiting.")
#         return

#     channel = connection.channel()

#     # Declare the queue. durable=True means the queue will survive a broker restart.
#     channel.queue_declare(queue=QUEUE_NAME, durable=True)
#     print(f" [WORKER] Waiting for messages on queue '{QUEUE_NAME}'. To exit press CTRL+C")

#     channel.basic_qos(prefetch_count=1)

    
#     channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)

    
#     channel.start_consuming()

# if __name__ == '__main__':
#     try:
#         start_worker()
#     except KeyboardInterrupt:
#         print(' [WORKER] Interrupted')
#         try:
#             sys.exit(0)
#         except SystemExit:
#             os._exit(0)

# backend/worker.py

# import pika
# import os
# import time
# import json
# import smtplib 
# from email.mime.text import MIMEText 
# from email.mime.multipart import MIMEMultipart 

# # Get RabbitMQ connection URL from environment variable
# RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
# QUEUE_NAME = "password_reset_queue"

# def send_real_email(to_email: str, reset_link: str):
#     """
#     Sends a real password reset email using smtplib and Gmail SMTP.
#     """
#     smtp_server = os.getenv("SMTP_SERVER")
#     smtp_port = int(os.getenv("SMTP_PORT", 587))
#     sender_email = os.getenv("EMAIL_SENDER")
#     sender_password = os.getenv("EMAIL_PASSWORD")

#     if not all([smtp_server, smtp_port, sender_email, sender_password]):
#         print(" [WORKER] ERROR: SMTP server settings are missing in environment variables. Cannot send real email.")
#         return

#     # Create the email message
#     message = MIMEMultipart("alternative")
#     message["Subject"] = "Your Password Reset Link"
#     message["From"] = f"Support Tickets App <{sender_email}>"
#     message["To"] = to_email

    
#     text = f"""
#     Hello,
#     You requested a password reset. Please use the following link to reset your password:
#     {reset_link}
#     This link will expire in 15 minutes.
#     """
    
#     html = f"""
#     <html>
#       <body>
#         <h2>Password Reset Request</h2>
#         <p>Hello,</p>
#         <p>You requested a password reset. Please click the button below to set a new password:</p>
#         <p style="margin: 20px 0;">
#           <a href="{reset_link}" 
#              style="background-color: #4299e1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
#             Reset Password
#           </a>
#         </p>
#         <p>This link will expire in 15 minutes.</p>
#         <p>If you did not request this, please ignore this email.</p>
#       </body>
#     </html>
#     """

#     # Turn these into plain/html MIMEText parts
#     part1 = MIMEText(text, "plain")
#     part2 = MIMEText(html, "html")

#     # Add HTML/plain-text parts to MIMEMultipart message
#     # The email client will try to render the last part first
#     message.attach(part1)
#     message.attach(part2)

#     try:
#         print(f" [WORKER] Connecting to SMTP server {smtp_server}:{smtp_port}...")
#         # Use a context manager for the SMTP connection
#         with smtplib.SMTP(smtp_server, smtp_port) as server:
#             server.starttls()  # Secure the connection
#             server.login(sender_email, sender_password)
#             server.sendmail(sender_email, to_email, message.as_string())
#             print(f" [WORKER] Email sent successfully to {to_email}!")
#     except Exception as e:
#         print(f" [WORKER] FAILED to send email to {to_email}. Error: {e}")


# def callback(ch, method, properties, body):
#     """
#     This function use to handle queue msg
#     """
#     print(f" [WORKER] Received message from queue '{QUEUE_NAME}'")
#     try:
#         message = json.loads(body.decode('utf-8'))
#         email = message.get("email")
#         token = message.get("token")

#         if not email or not token:
#             print(" [WORKER] Message is malformed. Skipping.")
#         else:
#             # Construct the full reset link
#             reset_link = f"http://localhost:5173/reset-password?token={token}"
            
#             send_real_email(email, reset_link)

#         # Acknowledge the message was processed
#         ch.basic_ack(delivery_tag=method.delivery_tag)

#     except Exception as e:
#         print(f" [WORKER] Error processing message: {e}")
#         ch.basic_ack(delivery_tag=method.delivery_tag)


# def start_worker():
#     "this funcn connect he rabbitmq and wait for msg"
#     connection = None
#     #retry up 10 times if rabit mq is not available
#     for i in range(10): 
#         try:
#             print(" [WORKER] Connecting to RabbitMQ...")
#             connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
#             print(" [WORKER] Connection successful!")
#             break
#         except pika.exceptions.AMQPConnectionError:
#             print(f" [WORKER] Connection failed. Retrying in 5 seconds... (Attempt {i+1}/10)")
#             time.sleep(5)
    
#     if not connection:
#         print(" [WORKER] Could not connect to RabbitMQ. Exiting.")
#         return

#     channel = connection.channel()
#     channel.queue_declare(queue=QUEUE_NAME, durable=True)
#     print(f" [WORKER] Waiting for messages on queue '{QUEUE_NAME}'. To exit press CTRL+C")
#     channel.basic_qos(prefetch_count=1)
#     channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)
#     channel.start_consuming()

# if __name__ == '__main__':
#     try:
#         start_worker()
#     except KeyboardInterrupt:
#         print(' [WORKER] Interrupted')



# def collection_exists(self, db_type: str, col_type: str) -> bool:
#         """
#         Check if a collection exists in the database using the read connection.
#         """
#         try:
#             # Get the correct database connection (read-replica in prod, primary in dev)
#             # Checking existence is a 'read' operation, so is_write=False
#             db = self.get_database_internal(db_type, is_write=False)
            
#             if db:
#                 # The core logic: check if the collection name is in the list of all names
#                 return col_type in db.list_collection_names()
                
#             return False # Return False if we couldn't get the database object
            
#         except Exception as e:
#             logger.exception(f"Error checking if collection '{col_type}' exists: {str(e)}")
#             return False # Return False on any error           