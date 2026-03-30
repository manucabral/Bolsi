"""Main entry point for the Bolsi application."""

import socket
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import webview

from backend.logger import logger, set_log_level
from backend.constants import config
from backend.api import BolsiApi
from backend import database


def find_free_port() -> int:
    """Find an available localhost TCP port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as socket_obj:
        socket_obj.bind(("127.0.0.1", 0))
        return int(socket_obj.getsockname()[1])


def serve_dist(directory: Path, port: int) -> None:
    """Serve frontend dist files over a local HTTP server."""
    handler_class = partial(SimpleHTTPRequestHandler, directory=str(directory))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler_class)
    logger.info("Serving frontend dist at http://127.0.0.1:%d", port)
    httpd.serve_forever()


def main():
    """Initialize and start Bolsi app."""
    set_log_level("DEBUG" if config.development_mode else "INFO")

    logger.info("Initializing database...")
    conn = database.init_database()

    api = BolsiApi(conn=conn)

    if config.development_mode:
        url = config.dev_server_url
        logger.info("Dev mode - using dev server URL: %s", url)
    elif config.frontend_dist_dir.exists():
        port = find_free_port()
        static_thread = threading.Thread(
            target=serve_dist,
            args=(config.frontend_dist_dir, port),
            daemon=True,
        )
        static_thread.start()
        url = f"http://127.0.0.1:{port}/index.html"
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
    webview.start(debug=config.development_mode)


if __name__ == "__main__":
    main()
