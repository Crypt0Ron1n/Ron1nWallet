import React, { useEffect } from 'react';

const SITE_NAME = 'Ron1n Syndicate — Shogun Wallet';
const DESCRIPTION =
  'Ron1n Shogun Wallet is a privacy-first, self-custody cryptocurrency wallet with explicit security policy, protected outbound transactions, key rotation, biometric authorization, quantum-aware exposure tracking, and auditable transaction controls.';
const CANONICAL = 'https://ron1nsyndicate.com/';

function upsertMeta(name: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertProperty(property: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function Ron1nSeoMetadata() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.title = SITE_NAME;

    upsertMeta('description', DESCRIPTION);
    upsertMeta(
      'keywords',
      'Ron1n Syndicate, Shogun Wallet, cryptocurrency wallet, self custody wallet, crypto security, protected transactions, key rotation, biometric wallet, quantum aware wallet, privacy first wallet'
    );
    upsertMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    upsertMeta('application-name', 'Ron1n Shogun Wallet');
    upsertMeta('theme-color', '#050505');
    upsertMeta('color-scheme', 'dark');

    upsertProperty('og:type', 'website');
    upsertProperty('og:site_name', 'Ron1n Syndicate');
    upsertProperty('og:title', SITE_NAME);
    upsertProperty('og:description', DESCRIPTION);
    upsertProperty('og:url', CANONICAL);

    upsertProperty('twitter:card', 'summary');
    upsertProperty('twitter:title', SITE_NAME);
    upsertProperty('twitter:description', DESCRIPTION);

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = CANONICAL;

    const structuredDataId = 'ron1n-structured-data';
    let script = document.getElementById(structuredDataId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = structuredDataId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${CANONICAL}#organization`,
          name: 'Ron1n Syndicate',
          url: CANONICAL,
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${CANONICAL}#shogun-wallet`,
          name: 'Ron1n Shogun Wallet',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Android, iOS, Web',
          description: DESCRIPTION,
          brand: {
            '@type': 'Brand',
            name: 'Ron1n Syndicate',
          },
          publisher: {
            '@id': `${CANONICAL}#organization`,
          },
          featureList: [
            'Self-custody cryptocurrency wallet',
            'Protected outbound transaction workflow',
            'Security policy evaluation before signing',
            'Key rotation and asset migration controls',
            'Biometric authorization',
            'Quantum-aware exposure tracking',
            'Privacy-first manual synchronization',
            'Transaction lifecycle and audit controls',
          ],
        },
      ],
    });
  }, []);

  return null;
}
