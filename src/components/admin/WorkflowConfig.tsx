import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Clock,
  CheckCircle2,
  Bell,
  Shield,
  Save,
  AlertTriangle,
  RefreshCw,
  FlaskConical,
  CalendarCheck,
} from 'lucide-react';
import { WorkflowStage, AssessmentAccessMode } from '../../types';
import { dataService } from '../../services/dataService';
import { authService } from '../../services/authService';

export const WorkflowConfig: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowStage[]>(dataService.getWorkflows(false));
  const [accessMode, setAccessMode] = useState<AssessmentAccessMode>(dataService.getAssessmentAccessMode());
  const [tempDelays, setTempDelays] = useState<Record<string, number>>({});
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  const refreshState = () => {
    const active = dataService.getWorkflows(false);
    setWorkflows(active);
    setAccessMode(dataService.getAssessmentAccessMode());
    const initialDelays: Record<string, number> = {};
    active.forEach((st) => {
      initialDelays[st.id] = st.delayDaysFromPrevious;
    });
    setTempDelays(initialDelays);
  };

  useEffect(() => {
    refreshState();
    const unsub = dataService.subscribe(() => {
      refreshState();
    });
    return () => unsub();
  }, []);

  const showNotice = (msg: string) => {
    setSavedSuccess(msg);
    setTimeout(() => setSavedSuccess(null), 4000);
  };

  const handleModeChange = async (newMode: AssessmentAccessMode) => {
    if (newMode === accessMode || savingMode) return;
    if (!isSuperAdmin) {
      setErrorMessage('Unauthorized: Only Super Admins can change assessment access mode.');
      return;
    }

    setSavingMode(true);
    setErrorMessage(null);
    try {
      const res = await dataService.setAssessmentAccessMode(newMode);
      if (res.success) {
        setAccessMode(newMode);
        showNotice(
          newMode === 'testing'
            ? 'Testing Mode enabled! Assessment waiting periods are temporarily bypassed.'
            : 'Scheduled Mode active! Configured assessment waiting periods are enforced.'
        );
      } else {
        setErrorMessage(res.error || 'Failed to update access mode in Firestore.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error communicating with Firestore.');
    } finally {
      setSavingMode(false);
    }
  };

  const handleSaveDelay = async (stageId: string) => {
    const rawVal = tempDelays[stageId];
    if (rawVal === undefined || isNaN(rawVal) || rawVal < 0 || !Number.isInteger(rawVal)) {
      setErrorMessage('Wait interval must be a valid non-negative integer (e.g. 0, 7, 14).');
      return;
    }

    setSavingStageId(stageId);
    setErrorMessage(null);
    try {
      const res = await dataService.updateStageDelay(stageId, rawVal);
      if (res.success) {
        showNotice(`Wait interval successfully saved and confirmed in Firestore!`);
      } else {
        setErrorMessage(res.error || 'Failed to save delay in Firestore.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating stage delay in Firestore.');
    } finally {
      setSavingStageId(null);
    }
  };

  const handleReconcileCanonical = async () => {
    if (!isSuperAdmin || reconciling) return;
    setReconciling(true);
    setErrorMessage(null);
    try {
      const res = await dataService.reconcileCanonicalWorkflowIfSuperAdmin();
      if (res.success) {
        showNotice('Canonical 6-stage clinical pathway atomically reconciled in Cloud Firestore!');
        refreshState();
      } else {
        setErrorMessage(res.error || 'Failed to reconcile canonical workflow.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error reconciling workflow.');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
              Clinical Assessment Pathway & Workflow
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-200">
              6-Stage Pathway
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure the chronological progression of assessments, waiting intervals, and testing mode.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && (
            <button
              onClick={handleReconcileCanonical}
              disabled={reconciling}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold border border-gray-300 transition-colors disabled:opacity-50 cursor-pointer"
              title="Align Firestore with canonical 6-stage pathway"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
              <span>{reconciling ? 'Reconciling...' : 'Reconcile Firestore'}</span>
            </button>
          )}

          {errorMessage && (
            <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-200 px-3.5 py-2 rounded-xl text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedSuccess}</span>
            </div>
          )}
        </div>
      </div>

      {/* ASSESSMENT ACCESS MODE CONTROLLER */}
      <div className={`rounded-2xl p-5 sm:p-6 border transition-all shadow-sm ${
        accessMode === 'testing'
          ? 'bg-amber-50/70 border-amber-300'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200/60">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className={`w-5 h-5 ${accessMode === 'testing' ? 'text-amber-600' : 'text-gray-600'}`} />
              <h2 className="text-base font-bold text-gray-950">Assessment Access Mode</h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                accessMode === 'testing'
                  ? 'bg-amber-200 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {accessMode === 'testing' ? 'Testing Mode Active' : 'Scheduled Mode Active'}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Controls whether assessment waiting periods are enforced for real authenticated client accounts.
            </p>
          </div>

          {/* Mode Switch Controls */}
          {isSuperAdmin ? (
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-xl border border-gray-300 shrink-0">
              <button
                type="button"
                onClick={() => handleModeChange('scheduled')}
                disabled={savingMode}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  accessMode === 'scheduled'
                    ? 'bg-white text-gray-950 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Scheduled Mode</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('testing')}
                disabled={savingMode}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  accessMode === 'testing'
                    ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Testing Mode</span>
              </button>
            </div>
          ) : (
            <span className="text-xs font-semibold text-gray-500 italic">
              Super Admin authorization required to toggle mode
            </span>
          )}
        </div>

        {/* Dynamic Mode Notice Banner */}
        <div className="mt-4">
          {accessMode === 'testing' ? (
            <div className="flex items-start gap-3 bg-amber-100/80 border border-amber-300 p-3.5 rounded-xl text-xs text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold tracking-wide uppercase text-[11px] text-amber-900">
                  TESTING MODE ACTIVE — Assessment waiting periods are temporarily bypassed.
                </p>
                <p className="mt-0.5 text-amber-900/90 leading-relaxed">
                  Authenticated clients can immediately open and complete all 5 active assessments without waiting for 7, 14, or 30 days. Real assessment responses and biodata will be recorded in Cloud Firestore. Configured waiting intervals remain safely stored and will re-apply upon returning to Scheduled Mode.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Scheduled Mode</strong> — Configured assessment waiting periods are strictly enforced across client journeys.
              </span>
            </div>
          )}
        </div>
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
          <span className="text-xs font-extrabold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
            Sequence ({workflows.length} Stages)
          </span>
        </div>

        <div className="space-y-4">
          {workflows.map((stage, idx) => {
            const currentDelay = tempDelays[stage.id] !== undefined ? tempDelays[stage.id] : stage.delayDaysFromPrevious;
            const isSavingThis = savingStageId === stage.id;
            const hasChanged = currentDelay !== stage.delayDaysFromPrevious;

            return (
              <div
                key={stage.id}
                className="p-4 sm:p-5 rounded-2xl border border-gray-200 bg-white hover:border-red-300 transition-all shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-gray-950 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {idx + 1}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-950">{stage.stageName}</h3>
                        <span className="text-[10px] font-mono text-gray-400">({stage.formId})</span>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          Active Pathway
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                    </div>
                  </div>

                  {/* Delay configuration input with explicit Save action */}
                  <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                    <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200 text-xs">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-gray-600 font-medium">Wait:</span>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={currentDelay}
                        disabled={!isSuperAdmin || isSavingThis}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setTempDelays((prev) => ({
                            ...prev,
                            [stage.id]: isNaN(val) ? 0 : Math.max(0, val),
                          }));
                        }}
                        className="w-14 px-1.5 py-0.5 text-center font-bold bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                      />
                      <span className="text-gray-600 font-medium">days</span>
                    </div>

                    {isSuperAdmin && (
                      <button
                        onClick={() => handleSaveDelay(stage.id)}
                        disabled={isSavingThis || !hasChanged}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          hasChanged
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs animate-pulse'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        }`}
                        title={hasChanged ? 'Save updated delay to Firestore' : 'No unsaved delay changes'}
                      >
                        <Save className="w-3 h-3" />
                        <span>{isSavingThis ? 'Saving...' : 'Save'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Informational Guidance */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 text-xs text-gray-600 space-y-1.5">
          <p className="font-bold text-gray-900 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-red-600" />
            Automated Clinical Scheduling & Notification Logic
          </p>
          <p>
            • When a client submits an assessment, the system references the canonical Firestore configuration and automatically schedules the next clinical assessment after the configured delay.
          </p>
          <p>
            • In <strong>Scheduled Mode</strong>, waiting intervals are strictly enforced. In <strong>Testing Mode</strong>, all active assessments are immediately accessible to authorized participants.
          </p>
        </div>
      </div>
    </div>
  );
};
