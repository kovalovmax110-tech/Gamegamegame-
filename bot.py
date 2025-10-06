import os
import logging
from flask import Flask, request, send_from_directory
from telegram import Update, WebAppInfo, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)

TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
if not TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set")

DOMAIN = os.environ.get('REPLIT_DEV_DOMAIN', 'localhost:5000')
WEBAPP_URL = f"https://{DOMAIN}"

app = Flask(__name__, static_folder='static', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory('static', path)

@app.route('/webhook', methods=['POST'])
async def webhook():
    try:
        update = Update.de_json(request.get_json(), telegram_app.bot)
        await telegram_app.process_update(update)
        return 'ok'
    except Exception as e:
        logger.error(f"Error processing update: {e}")
        return 'error', 500

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message:
        return
    
    keyboard = [[KeyboardButton("🎮 Играть в City Survival", web_app=WebAppInfo(url=WEBAPP_URL))]]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    
    await update.message.reply_text(
        "👋 Добро пожаловать в City Survival!\n\n"
        "🏙️ Выберите любой город в мире и попробуйте выжить в нем.\n"
        "🛡️ Стройте баррикады, собирайте ресурсы и защищайтесь!\n\n"
        "Нажмите кнопку ниже, чтобы начать игру:",
        reply_markup=reply_markup
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message:
        return
    
    await update.message.reply_text(
        "🎮 City Survival - игра на выживание\n\n"
        "Команды:\n"
        "/start - Начать игру\n"
        "/help - Показать эту справку\n\n"
        "Как играть:\n"
        "1. Нажмите кнопку 'Играть'\n"
        "2. Выберите город на карте мира\n"
        "3. Выберите дом для укрытия\n"
        "4. Стройте баррикады и выживайте!"
    )

telegram_app = Application.builder().token(TOKEN).build()

telegram_app.add_handler(CommandHandler("start", start))
telegram_app.add_handler(CommandHandler("help", help_command))

async def setup_webhook():
    webhook_url = f"https://{DOMAIN}/webhook"
    await telegram_app.bot.set_webhook(webhook_url)
    logger.info(f"Webhook set to: {webhook_url}")

if __name__ == '__main__':
    import asyncio
    
    async def init():
        await telegram_app.initialize()
        await setup_webhook()
    
    asyncio.run(init())
    
    logger.info(f"Starting server on port 5000...")
    logger.info(f"Web App URL: {WEBAPP_URL}")
    app.run(host='0.0.0.0', port=5000, debug=False)
