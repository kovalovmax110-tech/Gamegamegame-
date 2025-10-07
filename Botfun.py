# bot.py
# Установка:
#   pip install python-telegram-bot --upgrade

from telegram import ReplyKeyboardMarkup, Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes

# === НАСТРОЙКИ ===
API_TOKEN = "ВАШ_ТОКЕН_ОТ_BOTFATHER"  # <-- замените на свой токен
GAME_URL = "http://mygame.fun/"
# ==================

# Команда /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = "Добро пожаловать в City Survival"

    # Клавиатура с одной кнопкой "Играть"
    keyboard = ReplyKeyboardMarkup(
        [["Играть"]],
        resize_keyboard=True,       # делает кнопку компактной
        one_time_keyboard=False     # чтобы не исчезала после нажатия
    )

    await update.message.reply_text(text, reply_markup=keyboard)

# Обработка нажатия кнопки "Играть"
async def play_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text.lower() == "играть":
        await update.message.reply_text(GAME_URL)

def main():
    app = ApplicationBuilder().token(API_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, play_handler))

    print("✅ Бот запущен. Нажмите Ctrl+C чтобы остановить.")
    app.run_polling()

if __name__ == "__main__":
    main()
