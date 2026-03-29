import { useEffect } from "preact/hooks";
import { toast } from "sonner";

type SetState<T> = (value: T | ((previous: T) => T)) => void;

type KindNotice = {
  kind: "success" | "error";
  message: string;
};

type OkNotice = {
  ok: boolean;
  message: string;
};

export function useKindNoticeToast(
  notice: KindNotice | null,
  setNotice: SetState<KindNotice | null>,
) {
  useEffect(() => {
    if (!notice) return;

    if (notice.kind === "success") {
      toast.success(notice.message);
    } else {
      toast.error(notice.message);
    }

    setNotice(null);
  }, [notice, setNotice]);
}

export function useOkNoticeToast(
  notice: OkNotice | null,
  setNotice: SetState<OkNotice | null>,
) {
  useEffect(() => {
    if (!notice) return;

    if (notice.ok) {
      toast.success(notice.message);
    } else {
      toast.error(notice.message);
    }

    setNotice(null);
  }, [notice, setNotice]);
}

export function useStringNoticeToast(
  notice: string | null,
  setNotice: SetState<string | null>,
) {
  useEffect(() => {
    if (!notice) return;

    toast.error(notice);
    setNotice(null);
  }, [notice, setNotice]);
}
