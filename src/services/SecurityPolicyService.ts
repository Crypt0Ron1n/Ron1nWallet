export const SecurityPolicyService = {
  getPrivacyDisclosure() {
    return "Shogun Wallet operates on a Privacy-First model. By default, the app does not automatically fetch or share your data with public blockchains. Transaction history is retrieved only through explicit, user-initiated 'Manual Sync' requests, which are protected by biometric authentication.";
  },

  getNoCustodyDisclosure() {
    return "Shogun Wallet is a self-custodial application. We do not hold, manage, or have access to your private keys, recovery phrases, or funds. You are the sole custodian of your assets.";
  },

  getFeeDisclosure() {
    return "Network fees are required by blockchain protocols to process transactions. Shogun Wallet does not create, control, or receive any portion of these fees. Fees are paid directly to miners or validators.";
  },

  getQuantumDisclosure() {
    return "Ron1n security features are designed to reduce exposure and improve security posture. These post-quantum features are part of the Ron1n security roadmap and do not make external blockchains quantum-proof.";
  },

  getNoAdviceDisclosure() {
    return "Shogun Wallet does not provide investment, financial, or legal advice. All transactions are at the user's sole discretion and risk.";
  },

  getCoreRules() {
    return [
      "Shogun Wallet is strictly self-custodial.",
      "Your private keys and recovery phrases never leave your local device.",
      "Shogun Wallet does not collect, track, or share user wallet addresses.",
      "Manual Sync requires explicit biometric authorization for every request.",
      "Network fees are paid directly to miners/validators; Shogun does not receive these fees.",
      "Post-quantum security features are roadmap-based and do not guarantee immunity."
    ];
  },

  applyPolicy() {
    console.log('Ron1n Security Policy: Privacy Mode Default ON');
  }
};