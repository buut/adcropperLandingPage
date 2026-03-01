import React, { useMemo } from 'react';
import type { Stage, Layer } from '../App';
import { convertStagesToStageObject } from '../utils/stageExport';
import { convertReportToRequest } from '../utils/reportParser';

function findLayerName(layers: Layer[], layerId: string): string | null {
  for (const l of layers) {
    if (l.id === layerId) return l.name;
    if (l.children) {
      const found = findLayerName(l.children, layerId);
      if (found) return found;
    }
  }
  return null;
}

function collectAnimations(layers: Layer[], prefix = ''): Array<{ layerName: string; type: string; name: string; start: number; duration: number }> {
  const out: Array<{ layerName: string; type: string; name: string; start: number; duration: number }> = [];
  for (const l of layers) {
    const label = prefix ? `${prefix} › ${l.name}` : l.name;
    if (l.animation) {
      const a = l.animation;
      if (a.entry?.name) out.push({ layerName: label, type: 'Entry', name: a.entry.name, start: a.entry.start, duration: a.entry.duration });
      if (a.main?.name) out.push({ layerName: label, type: 'Main', name: a.main.name, start: a.main.start, duration: a.main.duration });
      if (a.exit?.name) out.push({ layerName: label, type: 'Exit', name: a.exit.name, start: a.exit.start, duration: a.exit.duration });
    }
    if (l.textAnimation) {
      const t = l.textAnimation;
      if (t.entry?.name) out.push({ layerName: label, type: 'Text Entry', name: t.entry.name, start: t.entry.start, duration: t.entry.duration });
      if (t.main?.name) out.push({ layerName: label, type: 'Text Main', name: t.main.name, start: t.main.start, duration: t.main.duration });
      if (t.exit?.name) out.push({ layerName: label, type: 'Text Exit', name: t.exit.name, start: t.exit.start, duration: t.exit.duration });
    }
    if (l.children?.length) {
      out.push(...collectAnimations(l.children, label));
    }
  }
  return out;
}

/** Object type and order: sorted by zIndex, child layers indented */
function collectLayerOrder(layers: Layer[], byZIndex: boolean): Array<{ order: number; type: string; name: string; depth: number; layer: Layer }> {
  const flat: Array<{ layer: Layer; depth: number }> = [];
  function walk(ls: Layer[], depth: number) {
    const sorted = byZIndex ? [...ls].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)) : ls;
    sorted.forEach((l) => {
      flat.push({ layer: l, depth });
      if (l.children && l.children.length > 0) walk(l.children, depth + 1);
    });
  }
  walk(layers, 0);
  return flat.map(({ layer, depth }, i) => ({
    order: i + 1,
    type: layer.type,
    name: layer.name || layer.id,
    depth,
    layer
  }));
}



/** One stage in report: input = operations text, output = getStageObject (node + animation). */
function formatStageReportBlock(stage: Stage): string {
  const operationsText = getOperationsTextForStage(stage);
  const naturalRequest = convertReportToRequest(operationsText);
  const stageObj = convertStagesToStageObject([stage]);
  const node = stageObj?.node ?? {};
  const animation = stageObj?.animation ?? {};
  const outputJson = JSON.stringify({ node, animation }, null, 2);

  const lines: string[] = [];
  lines.push(`========== Stage: ${stage.name} ==========`);
  lines.push('');
  lines.push('[NATURAL REQUEST]');
  lines.push(naturalRequest);
  lines.push('');
  lines.push('[INPUT] Operations performed:');
  lines.push(operationsText);
  lines.push('');
  lines.push('[OUTPUT] getStageObject (node + animation):');
  lines.push(outputJson);
  lines.push('');
  return lines.join('\n');
}

/** Full report: for each stage, input = operations text, output = getStageObject data. */
function generateReportText(stages: Stage[]): string {
  if (stages.length === 0) {
    return '[INPUT] Operations performed:\n  No stages.\n\n[OUTPUT] getStageObject:\n  {}';
  }
  const blocks = stages.map((s) => formatStageReportBlock(s));
  return '=== STAGE REPORT (Input = Operations performed, Output = getStageObject) ===\n\n' + blocks.join('\n');
}

/** Operations as plain text for fine-tuning input (one side of the pair). */
function getOperationsTextForStage(stage: Stage): string {
  const lines: string[] = [];
  lines.push(`Stage: ${stage.name}. Size: ${stage.width}x${stage.height}px. Duration: ${stage.duration}s.`);
  lines.push('');

  const layerOrder = collectLayerOrder(stage.layers, true);
  lines.push('Layers (type and order):');
  if (layerOrder.length === 0) {
    lines.push('  None.');
  } else {
    layerOrder.forEach(({ order, type, name, depth, layer }) => {
      const indent = '  '.repeat(depth + 1);
      const lw = Math.round(layer.width);
      const lh = Math.round(layer.height);
      const lx = Math.round(layer.x - layer.width / 2);
      const ly = Math.round(layer.y - layer.height / 2);
      const rx = Math.round(stage.width - (layer.x + layer.width / 2));
      const by = Math.round(stage.height - (layer.y + layer.height / 2));

      let xDesc = lx === 0 ? "L:0" : `${lx}`;
      let yDesc = ly === 0 ? "T:0" : `${ly}`;
      if (Math.abs(layer.x - stage.width / 2) < 5) xDesc = "center";
      if (Math.abs(layer.y - stage.height / 2) < 5) yDesc = "center";

      lines.push(`${indent}${order}. ${type}: ${name} [${lw}x${lh} at ${xDesc},${yDesc}]`);
    });
  }


  lines.push('');

  const actions = stage.actions || [];
  lines.push('Actions performed:');
  if (actions.length === 0) {
    lines.push('  None.');
  } else {
    actions.forEach((a) => {
      const sourceName = a.triggerSourceId === 'stage' ? 'Stage' : (findLayerName(stage.layers, a.triggerSourceId) || a.triggerSourceId);
      const targetName = findLayerName(stage.layers, a.triggerTargetId) || a.triggerTargetId;
      const event = (a.eventType || 'trigger').toLowerCase();
      lines.push(`  - On ${event} on "${sourceName}": apply ${a.actionType} to "${targetName}".`);
    });
  }
  lines.push('');

  const anims = collectAnimations(stage.layers);
  lines.push('Animations (phase: entry, main, or exit):');
  if (anims.length === 0) {
    lines.push('  None.');
  } else {
    anims.forEach((anim) => {
      lines.push(`  - ${anim.type}: ${anim.name} on layer "${anim.layerName}" at ${anim.start.toFixed(1)}s, duration ${anim.duration.toFixed(1)}s.`);
    });
  }

  return lines.join('\n');
}

/** JSONL for fine-tuning: prompt = operations text, completion = getStageObject node + animation. */
function generateFineTuningJSONL(stages: Stage[]): string {
  if (stages.length === 0) return '';
  const lines: string[] = [];
  for (const stage of stages) {
    const operationsText = getOperationsTextForStage(stage);
    const naturalRequest = convertReportToRequest(operationsText);
    const stageObj = convertStagesToStageObject([stage]);
    const node = stageObj?.node ?? {};
    const animation = stageObj?.animation ?? {};
    const completion = JSON.stringify({ node, animation });
    const record = { prompt: naturalRequest, completion };
    lines.push(JSON.stringify(record));
  }
  return lines.join('\n');
}

/** CSV for fine-tuning: natural_request,input,output with escaping. */
function generateFineTuningCSV(stages: Stage[]): string {
  if (stages.length === 0) return '';
  const lines: string[] = ['natural_request,input,output'];

  const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;

  for (const stage of stages) {
    const operationsText = getOperationsTextForStage(stage);
    const naturalRequest = convertReportToRequest(operationsText);
    const stageObj = convertStagesToStageObject([stage]);
    const node = stageObj?.node ?? {};
    const animation = stageObj?.animation ?? {};
    const outputJson = JSON.stringify({ node, animation });

    lines.push(`${escapeCSV(naturalRequest)},${escapeCSV(operationsText)},${escapeCSV(outputJson)}`);
  }
  return lines.join('\n');
}

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  stages: Stage[];
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({ isOpen, onClose, stages }) => {
  const reportText = useMemo(() => generateReportText(stages), [stages]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stage-report-finetuning.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSONL = () => {
    const jsonl = generateFineTuningJSONL(stages);
    if (!jsonl) return;
    const blob = new Blob([jsonl], { type: 'application/jsonl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stage-finetuning.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const csv = generateFineTuningCSV(stages);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stage-finetuning.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">settings</span>
            Stage Report (Fine-tuning)
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Copy
            </button>
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              .txt
            </button>
            <button
              type="button"
              onClick={handleDownloadJSONL}
              disabled={stages.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[18px]">dataset</span>
              JSONL
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={stages.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-[60vh] overflow-auto select-text selection:bg-primary/20">
            {reportText}
          </pre>
          <p className="text-xs text-gray-500 mt-3">
            <strong>Report:</strong> For each stage, <strong>[INPUT]</strong> = Operations performed (text). <strong>[OUTPUT]</strong> = getStageObject (node + animation) JSON. <strong>JSONL:</strong> same input/output as prompt/completion.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPopup;
