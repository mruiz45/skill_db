'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function CvPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCv = async () => {
    if (!user || !user.id) {
        setError("User not authenticated or user ID not found.");
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cv/generate?userId=${user.id}`);

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorBody = await response.text();
          errorMsg = `${errorMsg} - ${errorBody}`;
        } catch (e) { /* Ignore if body cannot be read */ }
        throw new Error(errorMsg);
      }

      const disposition = response.headers.get('content-disposition');
      let filename = "Generated_CV.docx";
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"])(?:\\.|[^\'"])*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('Failed to generate CV:', err);
      setError(err.message || 'Failed to generate CV. Please check the console.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Mon CV</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <p className="text-gray-600 mb-4">Contenu de la page CV à venir...</p>
        {/* Add CV generation/upload/view components here */}
        
        <button
          onClick={handleGenerateCv}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Generating...' : 'Generate CV'}
        </button>

        {error && (
          <p className="text-red-500 mt-4">Error: {error}</p>
        )}
      </div>
    </div>
  );
} 