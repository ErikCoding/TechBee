export const STUDENT_SERVICE_FEE_RATE = 0.03
export const STUDENT_SERVICE_FEE_MIN_GROSZE = 299

export type StudentPaymentBreakdown = {
  subtotalGrosze: number
  studentServiceFeeGrosze: number
  studentTotalGrosze: number
}

function normalizeGrosze(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

export function calculateStudentServiceFeeGrosze(subtotalGrosze: number): number {
  const subtotal = normalizeGrosze(subtotalGrosze)
  if (subtotal <= 0) return 0
  return Math.max(Math.round(subtotal * STUDENT_SERVICE_FEE_RATE), STUDENT_SERVICE_FEE_MIN_GROSZE)
}

export function buildStudentPaymentBreakdown(subtotalGrosze: number): StudentPaymentBreakdown {
  const subtotal = normalizeGrosze(subtotalGrosze)
  const studentServiceFeeGrosze = calculateStudentServiceFeeGrosze(subtotal)
  return {
    subtotalGrosze: subtotal,
    studentServiceFeeGrosze,
    studentTotalGrosze: subtotal + studentServiceFeeGrosze,
  }
}
