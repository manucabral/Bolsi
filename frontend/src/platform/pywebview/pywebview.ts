type PyApi = NonNullable<Window["pywebview"]>["api"];

export function getBolsiApi(): Promise<PyApi> {
  return new Promise((resolve) => {
    if (window.pywebview?.api) {
      resolve(window.pywebview.api);
      return;
    }
    window.addEventListener(
      "pywebviewready",
      () => resolve(window.pywebview!.api),
      { once: true },
    );
  });
}
