export function lessonTeacherTransferIdempotencyKey(lessonId: string): string {
  return `lesson:${lessonId}:teacher-release:v1`
}
