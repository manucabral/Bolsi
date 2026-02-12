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
    url = (
        config.dev_server_url
        if config.frontend_dist_dir is None
        else config.frontend_dist_dir.as_uri()
    )
    if config.frontend_dist_dir is None:
        logger.warning("Frontend distribution directory not found!")
        logger.warning("Using dev server URL: %s", url)

    logger.info("Starting window %dx%d", config.window_width, config.window_height)
    webview.create_window(
        config.app_name,
        url=url,
        width=config.window_width,
        height=config.window_height,
        js_api=api,
        confirm_close=True,
        text_select=True,
        zoomable=True,
    )
    webview.start(debug=True)


if __name__ == "__main__":
    main()
