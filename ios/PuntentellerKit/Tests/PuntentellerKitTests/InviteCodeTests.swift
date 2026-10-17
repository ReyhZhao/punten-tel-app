import Testing
@testable import PuntentellerKit

@Suite struct InviteCodeTests {
    @Test func parsesTypedCodes() {
        #expect(InviteCode.parse("482913") == "482913")
        #expect(InviteCode.parse(" 482 913 ") == "482913")
        #expect(InviteCode.parse("48291") == nil)
        #expect(InviteCode.parse("4829134") == nil)
        #expect(InviteCode.parse("anna@example.com") == nil)
    }

    @Test func parsesQRPayload() {
        #expect(InviteCode.parse(InviteCode.qrPayload("012345")) == "012345")
        #expect(InviteCode.parse("https://punten.vels.online/?uitnodigcode=12ab56") == nil)
        #expect(InviteCode.parse("https://example.com/") == nil)
    }

    @Test func formats() {
        #expect(InviteCode.formatted("482913") == "482 913")
    }
}
