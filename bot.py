import logging
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# ============ НАСТРОЙКИ ============
# ВСТАВЬ СВОЙ ТОКЕН СЮДА 👇 (без пробелов, кавычки оставь)
TOKEN = "ВСТАВЬ_СЮДА_СВОЙ_ТОКЕН_ОТ_BOTFATHER"

# Ссылка на твою игру (GitHub Pages или Netlify)
WEBAPP_URL = "https://твоя-ссылка-на-игру.github.io/"

# Включаем логирование для отладки
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ============ КОМАНДЫ ============
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start — приветствие и ссылка на игру"""
    if not update.message:
        return

    keyboard = [[KeyboardButton("🎮 Играть в City Survival")]]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

    await update.message.reply_text(
        "👋 Добро пожаловать в City Survival!\n\n"
        "🏙️ Исследуй города, строй баррикады и выживай!\n"
        "🛡️ Собирай ресурсы и защищай своих жителей.\n\n"
        f"👉 Начни игру здесь:\n{WEBAPP_URL}",
        reply_markup=reply_markup
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help — помощь"""
    await update.message.reply_text(
        "ℹ️ Команды бота:\n"
        "/start — запустить бота\n"
        "/help — помощь"
    )


# ============ ГЛАВНЫЙ ЗАПУСК ============
def main():
    """Главная функция запуска Telegram-бота"""
    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))

    logger.info("✅ Бот запущен и готов к работе!")
    app.run_polling()


if __name__ == "__main__":
    main()
