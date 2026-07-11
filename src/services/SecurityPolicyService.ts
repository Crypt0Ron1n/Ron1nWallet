export class SecurityPolicyService {
  static getCoreRules() {
    return [
      'Shogun Wallet is self-custodial.',
      'Shogun Wallet does not custody user funds.',
      'Shogun Wallet does not collect recovery phrases or private keys.',
      'Shogun Wallet does not provide investment advice.',
      'Shogun Wallet does not guarantee profits.',
      'Network fees are paid to miners, validators, or network participants.',
      'Shogun Wallet does not create, control, or receive network fees.',
      'Public blockchain transactions may be visible on their native networks.',
      'Ron1n security features are designed to reduce exposure and improve security posture.',
      'Post-quantum features are part of the Ron1n security roadmap and do not make external blockchains quantum-proof.',
    ];
  }

  static getFeeDisclosure() {
    return 'Network fees are required by the selected blockchain network. Shogun Wallet does not create, control, or receive these fees.';
  }

  static getPrivacyDisclosure() {
    return 'Private wallet activity is stored locally on this device. Public-chain activity is fetched only when the user chooses to sync.';
  }

  static getQuantumDisclosure() {
    return 'Ron1n is a quantum-readiness security layer. It does not make BTC, ETH, SOL, XRP, or other external networks quantum-proof.';
  }

  static getNoCustodyDisclosure() {
    return 'Shogun Wallet is self-custodial. The user controls their wallet, keys, and recovery phrase.';
  }

  static getNoAdviceDisclosure() {
    return 'Shogun Wallet does not provide investment, financial, tax, or legal advice. Users are responsible for their own transactions.';
  }
}