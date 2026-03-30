import type { UploadResult } from "../types";

interface FileUploadProps {
  onUploadComplete: (result: UploadResult) => void;
}

export default function FileUpload({ onUploadComplete: _onUploadComplete }: FileUploadProps) {
  return <div>FileUpload placeholder</div>;
}
