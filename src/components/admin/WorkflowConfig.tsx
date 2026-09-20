import React, { useState } from 'react';
import {
  GitBranch,
  Clock,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  CheckCircle2,
  Bell,
  Settings,
  ArrowRight,
  Shield,
  Save,
} from 'lucide-react';
import { WorkflowStage, FormDefinition } from '../../types';
import { dataService } from '../../services/dataService';

export const WorkflowConfig: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowStage[]>(dataService.getWorkflows());
  const forms = dataService.getForms();
  const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleUpdateDelay = (stageId: string, delayDays: number) => {
    const updated = workflows.map((w) =>
      w.id === stageId ? { ...w, delayDaysFromPrevious: Math.max(0, delayDays) } : w
    );
    setWorkflows(updated);
    dataService.saveWorkflows(updated);
    showNotice();
  };

  const handleToggleStage = (stageId: string) => {
    const updated = workflows.map((w) =>
      w.id === stageId ? { ...w, isActive: !w.isActive } : w
    );
    setWorkflows(updated);
    dataService.saveWorkflows(updated);
    showNotice();
  };

  const handleMove = (index: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? index - 1 : index + 1;
    if (targetIdx <= 0 || targetIdx >= workflows.length) return; // Keep registration as step 0

    const list = [...workflows];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    // Recalculate orders
    list.forEach((item, i) => {
      item.order = i;
    });

    setWorkflows(list);
    dataService.saveWorkflows(list);
    showNotice();
  };

  const showNotice = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Automated Assessment Sequence & Workflow
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure the chronological progression of assessments, delay intervals, and reminder triggers.
          </p>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Workflow updated in live database!</span>
          </div>
        )}
      </div>

      {/* Main Workflow Timeline Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Current Assessment Sequence</h2>
            <p className="text-xs text-gray-500">
              When a client completes one stage, the system automatically schedules the next stage after the configured delay.
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-400">Sequence ({workflows.length} Stages)</span>
        </div>

        <div className="space-y-4">
          {workflows.map((stage, idx) => (
            <div
              key={stage.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                stage.isActive
                  ? 'border-gray-200 bg-white hover:border-red-300'
                  : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-gray-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-950">{stage.stageName}</h3>
                      {stage.isInitialRegistration && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                          Intake Milestone
                        </span>
                      )}
                      {!stage.isActive && (
                        <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                  </div>
                </div>

                {/* Delay configuration input & reordering */}
                <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                  {!stage.isInitialRegistration && (
                    <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200 text-xs">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-gray-600 font-medium">Wait:</span>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={stage.delayDaysFromPrevious}
                        onChange={(e) => handleUpdateDelay(stage.id, parseInt(e.target.value, 10) || 0)}
                        className="w-12 px-1.5 py-0.5 text-center font-bold bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <span className="text-gray-600 font-medium">days</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      disabled={idx <= 1} // Keep registration first
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 disabled:opacity-20"
                      title="Move Up"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === 0 || idx === workflows.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 disabled:opacity-20"
                      title="Move Down"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!stage.isInitialRegistration && (
                    <button
                      onClick={() => handleToggleStage(stage.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                        stage.isActive
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {stage.isActive ? 'Disable Stage' : 'Enable Stage'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Informational Guidance */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 text-xs text-gray-600 space-y-1.5">
          <p className="font-bold text-gray-900 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-red-600" />
            Automated Notification Logic
          </p>
          <p>
            • When a stage becomes due (at the end of its wait interval), an automated SMS & Email reminder is queued with the client's direct access link.
          </p>
          <p>
            • If no submission is logged within 72 hours of the due date, the system flags the client as <strong>Overdue</strong> and alerts the assigned counsellor.
          </p>
        </div>
      </div>
    </div>
  );
};
