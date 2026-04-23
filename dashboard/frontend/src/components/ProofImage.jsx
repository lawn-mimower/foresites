import React from 'react';
import S3Image from './S3Image';

export default function ProofImage({ proofKey, apiCall, apiBase }) {
  if (!proofKey) return null;

  return (
    <S3Image
      src={proofKey}
      apiCall={apiCall}
      apiBase={apiBase}
      alt="Proof"
      label="Proof Submitted"
      onClick={(url) => window.open(url, "_blank")}
    />
  );
}
