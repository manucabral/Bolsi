"""Main entry point for the Bolsi application."""

import webview

from backend.logger import logger, set_log_level
from backend.constants import config
from backend.api import BolsiApi
from backend import database


def main():
    """Initialize and start Bolsi app."""
    set_log_level("DEBUG")

    logger.info("Initializing database...")
    conn = database.init_database()

    api = BolsiApi(conn=conn)

    if config.development_mode:
        url = config.dev_server_url
        logger.info("Dev mode - using dev server URL: %s", url)
    elif config.frontend_dist_dir.exists():
        url = config.frontend_dist_dir.as_uri()
    else:
        logger.warning("Frontend dist not found, falling back to dev server")
        url = config.dev_server_url

    logger.info("Starting window %dx%d", config.window_width, config.window_height)
    webview.create_window(
        config.app_name,
        url=url,
        width=config.window_width,
        height=config.window_height,
        js_api=api,
        confirm_close=False,
        text_select=True,
        maximized=True,
        zoomable=True,
    )
    webview.start(debug=True)


if __name__ == "__main__":
    main()
