const toBankAccountDto = (account) => ({
  bankName: typeof account?.bankName === "string" ? account.bankName : "",
  accountNumber:
    typeof account?.accountNumber === "string" ? account.accountNumber : "",
  accountHolderName:
    typeof account?.accountHolderName === "string"
      ? account.accountHolderName
      : "",
});

const toPaymentInstructionsDto = (studio, packageId) => ({
  ...(packageId ? { packageId: packageId.toString() } : {}),
  studio: {
    id: studio._id.toString(),
    name: studio.studioName,
  },
  bankDetails: (studio.bankDetails || []).map(toBankAccountDto),
});

module.exports = { toBankAccountDto, toPaymentInstructionsDto };
