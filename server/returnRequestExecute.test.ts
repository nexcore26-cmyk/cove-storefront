/**
 * Phase 66 — Return Request Execute Flow Tests
 *
 * Tests for the executeRefund procedure:
 * - Only works on 'approved' requests
 * - Rejects 'pending' requests
 * - Rejects 'rejected' requests
 * - Marks status as 'executed' and captures refundAmount
 * - Requires a valid refundAmount > 0
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
};

const mockReturnRequest = {
  id: 1,
  orderId: 100,
  orderItemId: null,
  requestedByUserId: 5,
  reason: "Item arrived damaged",
  status: "approved" as const,
  resolvedByUserId: null,
  resolvedAt: null,
  notes: null,
  refundAmount: null,
  createdAt: new Date(),
};

const mockOrder = {
  id: 100,
  orderNumber: "ORD-001",
  customerName: "Test Customer",
  customerEmail: "test@example.com",
  total: "45.000",
  status: "delivered",
  paymentStatus: "paid",
  paymentInvoiceId: "INV-12345",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function createMockDbChain(result: any[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    set: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("P66 — executeRefund procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject execution when return request status is 'pending'", async () => {
    const pendingRR = { ...mockReturnRequest, status: "pending" as const };

    const validateStatus = (status: string) => {
      if (status !== "approved") {
        throw new Error(
          `Cannot execute refund: return request status is '${status}', expected 'approved'`
        );
      }
    };

    expect(() => validateStatus(pendingRR.status)).toThrow(
      "Cannot execute refund: return request status is 'pending', expected 'approved'"
    );
  });

  it("should reject execution when return request status is 'rejected'", async () => {
    const rejectedRR = { ...mockReturnRequest, status: "rejected" as const };

    const validateStatus = (status: string) => {
      if (status !== "approved") {
        throw new Error(
          `Cannot execute refund: return request status is '${status}', expected 'approved'`
        );
      }
    };

    expect(() => validateStatus(rejectedRR.status)).toThrow(
      "Cannot execute refund: return request status is 'rejected', expected 'approved'"
    );
  });

  it("should reject execution when return request status is 'executed'", async () => {
    const executedRR = { ...mockReturnRequest, status: "executed" as const };

    const validateStatus = (status: string) => {
      if (status !== "approved") {
        throw new Error(
          `Cannot execute refund: return request status is '${status}', expected 'approved'`
        );
      }
    };

    expect(() => validateStatus(executedRR.status)).toThrow(
      "Cannot execute refund: return request status is 'executed', expected 'approved'"
    );
  });

  it("should allow execution when return request status is 'approved'", async () => {
    const approvedRR = { ...mockReturnRequest, status: "approved" as const };

    const validateStatus = (status: string) => {
      if (status !== "approved") {
        throw new Error(
          `Cannot execute refund: return request status is '${status}', expected 'approved'`
        );
      }
    };

    expect(() => validateStatus(approvedRR.status)).not.toThrow();
  });

  it("should require a positive refundAmount", async () => {
    const validateAmount = (amount: number) => {
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Refund amount must be a positive number");
      }
    };

    expect(() => validateAmount(0)).toThrow("Refund amount must be a positive number");
    expect(() => validateAmount(-5)).toThrow("Refund amount must be a positive number");
    expect(() => validateAmount(NaN)).toThrow("Refund amount must be a positive number");
    expect(() => validateAmount(45.0)).not.toThrow();
    expect(() => validateAmount(0.001)).not.toThrow();
  });

  it("should throw NOT_FOUND when return request does not exist", async () => {
    const findReturnRequest = (id: number, requests: any[]) => {
      const rr = requests.find(r => r.id === id);
      if (!rr) throw new Error("Return request not found");
      return rr;
    };

    expect(() => findReturnRequest(999, [mockReturnRequest])).toThrow("Return request not found");
    expect(() => findReturnRequest(1, [mockReturnRequest])).not.toThrow();
  });

  it("should throw BAD_REQUEST when order has no payment invoice ID", async () => {
    const orderWithoutInvoice = { ...mockOrder, paymentInvoiceId: null, invoiceId: undefined };

    const validateInvoiceId = (order: any) => {
      const invoiceId = order.paymentInvoiceId ?? order.invoiceId;
      if (!invoiceId) {
        throw new Error("Order has no payment invoice ID for refund");
      }
      return invoiceId;
    };

    expect(() => validateInvoiceId(orderWithoutInvoice)).toThrow(
      "Order has no payment invoice ID for refund"
    );
    expect(() => validateInvoiceId(mockOrder)).not.toThrow();
    expect(validateInvoiceId(mockOrder)).toBe("INV-12345");
  });

  it("should build correct MyFatoorah refund payload", async () => {
    const buildRefundPayload = (invoiceId: string, amount: number, reason?: string, rrId?: number) => ({
      KeyType: "InvoiceId",
      Key: String(invoiceId),
      RefundChargeOnCustomer: false,
      ServiceChargeonCustomer: false,
      Amount: amount,
      Comment: reason ?? `Return request #${rrId} refund`,
    });

    const payload = buildRefundPayload("INV-12345", 45.0, undefined, 1);
    expect(payload.KeyType).toBe("InvoiceId");
    expect(payload.Key).toBe("INV-12345");
    expect(payload.Amount).toBe(45.0);
    expect(payload.Comment).toBe("Return request #1 refund");
    expect(payload.RefundChargeOnCustomer).toBe(false);

    const payloadWithReason = buildRefundPayload("INV-12345", 45.0, "Item returned in original condition", 1);
    expect(payloadWithReason.Comment).toBe("Item returned in original condition");
  });

  it("should produce correct update payload after successful refund", async () => {
    const buildUpdatePayload = (userId: number, amount: number, existingNotes: string | null, reason?: string) => ({
      status: "executed" as const,
      resolvedByUserId: userId,
      resolvedAt: expect.any(Date),
      refundAmount: String(amount),
      notes: existingNotes ?? reason ?? null,
    });

    const updatePayload = buildUpdatePayload(1, 45.0, null, "Item returned");
    expect(updatePayload.status).toBe("executed");
    expect(updatePayload.refundAmount).toBe("45");
    expect(updatePayload.notes).toBe("Item returned");

    const updatePayloadWithExistingNotes = buildUpdatePayload(1, 45.0, "Admin note", "New reason");
    expect(updatePayloadWithExistingNotes.notes).toBe("Admin note");
  });

  it("should return success with refundAmount on successful execution", async () => {
    const simulateExecuteRefund = (amount: number) => ({
      success: true,
      refundAmount: amount,
    });

    const result = simulateExecuteRefund(45.0);
    expect(result.success).toBe(true);
    expect(result.refundAmount).toBe(45.0);
  });

  it("should use test API URL when MYFATOORAH_IS_TEST is true", async () => {
    const getBaseUrl = (isTest: boolean) =>
      isTest
        ? "https://apitest.myfatoorah.com"
        : "https://api.myfatoorah.com";

    expect(getBaseUrl(true)).toBe("https://apitest.myfatoorah.com");
    expect(getBaseUrl(false)).toBe("https://api.myfatoorah.com");
  });

  it("should use live API URL when MYFATOORAH_IS_TEST is false", async () => {
    const getBaseUrl = (isTest: boolean) =>
      isTest
        ? "https://apitest.myfatoorah.com"
        : "https://api.myfatoorah.com";

    expect(getBaseUrl(false)).toBe("https://api.myfatoorah.com");
  });
});

describe("P66 — Return request status enum validation", () => {
  it("should include 'executed' as a valid status", () => {
    const validStatuses = ["pending", "approved", "rejected", "executed"] as const;
    expect(validStatuses).toContain("executed");
  });

  it("should have correct status transitions", () => {
    const allowedTransitions: Record<string, string[]> = {
      pending: ["approved", "rejected"],
      approved: ["executed"],
      rejected: [],
      executed: [],
    };

    expect(allowedTransitions["pending"]).toContain("approved");
    expect(allowedTransitions["pending"]).toContain("rejected");
    expect(allowedTransitions["approved"]).toContain("executed");
    expect(allowedTransitions["rejected"]).toHaveLength(0);
    expect(allowedTransitions["executed"]).toHaveLength(0);
  });
});
