export function migrationUploadHeaders(mimeType: string): Record<string, string> {
  // PutObject Tagging is hoisted into the presigned query string by the AWS
  // SDK. Repeating it as a header causes S3 to reject the request as unsigned.
  return { "Content-Type": mimeType };
}
