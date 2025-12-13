import React from 'react';

export default function FileImport({ onFiles }: { onFiles: (files: FileList) => void }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Import</h3>
      <label className="block">
        <span className="sr-only">Choose audio files</span>
        <input
          className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
          type="file" accept="audio/*" multiple
          onChange={(e) => { if (e.target.files) onFiles(e.target.files); }}
        />
      </label>
      <p className="mt-2 text-xs text-slate-400">Drop in WAV/MP3/OGG files to create tracks.</p>
    </div>
  );
}

