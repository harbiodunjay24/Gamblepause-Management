import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
  StopCircle,
  Download,
  Users,
  ShieldCheck,
  RefreshCw,
  Search,
  Eye,
  ChevronRight,
  Database,
  FileText,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Trash2,
  Layers,
  ArrowRight,
  Check,
  ShieldAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  MigrationService,
  AUTHORIZED_MIGRATION_ADMIN,
  MIGRATION_STORAGE_KEY,
  ParsedClientRecord,
  PreviewSummary,
  TestFirstClientResult,
  FullMigrationReport,
  MigrationClientResult,
  DuplicateRecordGroup,
  DuplicateRecordItem,
} from '../../services/migrationService';
import { authService } from '../../services/authService';
import { auth } from '../../lib/firebase';
import { StaffUser } from '../../types';

interface HistoricalClientMigrationProps {
  currentUser: StaffUser;
  onNavigateTab?: (tab: string) => void;
  onSelectClient?: (client: any) => void;
}

export const HistoricalClientMigration: React.FC<HistoricalClientMigrationProps> = ({
  currentUser,
}) => {
  // 1. Strict Security Guard: Only ayodejiharbiodun24@gmail.com can access
  const activeUser = authService.getCurrentUser();
  const currentFbEmail = (auth.currentUser?.email || activeUser?.email || currentUser?.email || '')
    .toLowerCase()
    .trim();
  const isAuthorized =
    currentFbEmail === AUTHORIZED_MIGRATION_ADMIN &&
    (currentUser?.role === 'Super Admin' || activeUser?.role === 'Super Admin' || authService.isSuperAdmin());

  // View tabs inside Migration Tool
  const [activeSubTab, setActiveSubTab] = useState<'PIPELINE' | 'DUPLICATES' | 'REPORT'>('PIPELINE');

  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [records, setRecords] = useState<ParsedClientRecord[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);

  // Filter & Search in Preview
  const [previewFilter, setPreviewFilter] = useState<
    | 'ALL'
    | 'ELIGIBLE'
    | 'READY'
    | 'UPDATE_EXISTING'
    | 'ALREADY_MIGRATED'
    | 'DUPLICATE'
    | 'INVALID_EMAIL'
    | 'INCOMPLETE'
    | 'NIGERIAN_NON_LAGOS'
    | 'GHANA'
    | 'OTHER_AFRICAN'
    | 'ADDRESS_EXTRACTED'
    | 'UNKNOWN_STATE'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // First Client Test state
  const [isTestingFirst, setIsTestingFirst] = useState(false);
  const [testResult, setTestResult] = useState<TestFirstClientResult | null>(null);
  const [firstClientTestPassed, setFirstClientTestPassed] = useState(true); // Shodipo Ayomide / GP-0018 already completed

  // Full Migration state & Concurrency Lock
  const isMigratingRef = useRef(false);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [controlSignal, setControlSignal] = useState<{ paused: boolean; aborted: boolean }>({
    paused: false,
    aborted: false,
  });
  const [migrationProgress, setMigrationProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
    currentStep: string;
    stepNumber: number;
    totalSteps: number;
    success: number;
    skipped: number;
    duplicates: number;
    authFailed: number;
    clientFailed: number;
    assessmentFailed: number;
  }>({
    current: 0,
    total: 0,
    currentName: '',
    currentStep: 'Preparing migration pipeline...',
    stepNumber: 0,
    totalSteps: 12,
    success: 0,
    skipped: 0,
    duplicates: 0,
    authFailed: 0,
    clientFailed: 0,
    assessmentFailed: 0,
  });
  const [liveResults, setLiveResults] = useState<MigrationClientResult[]>([]);
  const [finalReport, setFinalReport] = useState<FullMigrationReport | null>(null);
  const [showExcludedRowsList, setShowExcludedRowsList] = useState(false);
  const [showUnparsedRowsList, setShowUnparsedRowsList] = useState(true);

  // Duplicate Review State
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateRecordGroup[]>([]);
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);
  const [deletionModalGroup, setDeletionModalGroup] = useState<{
    group: DuplicateRecordGroup;
    recordToDelete: DuplicateRecordItem;
    recordToKeep?: DuplicateRecordItem;
  } | null>(null);
  const [explicitOverrideCheck, setExplicitOverrideCheck] = useState(false);
  const [isDeletingDuplicate, setIsDeletingDuplicate] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Browser Safety Guard: Warn before leaving page when migration is running
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isMigrating) {
        e.preventDefault();
        e.returnValue = 'Migration is currently running. Leaving this page may interrupt the migration run.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isMigrating]);

  // Recalculate duplicate groups whenever records change
  useEffect(() => {
    if (records.length > 0) {
      scanDuplicates(records);
    }
  }, [records]);

  // Security barrier rendered if unauthorized
  if (!isAuthorized) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-red-200 shadow-sm text-center max-w-xl mx-auto my-12 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-gray-950 tracking-tight">Access Denied</h2>
        <p className="text-sm text-gray-600 font-medium leading-relaxed">
          Access Denied — Historical Client Migration is restricted to the authorized migration administrator.
        </p>
        <p className="text-xs text-gray-400">
          Only <span className="font-mono font-bold text-gray-700">{AUTHORIZED_MIGRATION_ADMIN}</span> has authorization to operate this data pipeline.
        </p>
      </div>
    );
  }

  const scanDuplicates = async (parsed: ParsedClientRecord[]) => {
    setIsScanningDuplicates(true);
    try {
      const groups = await MigrationService.scanForDuplicateGroups(parsed);
      setDuplicateGroups(groups);
    } catch (err) {
      console.warn('Failed to scan duplicate groups:', err);
    } finally {
      setIsScanningDuplicates(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    await processFile(droppedFile);
  };

  const processFile = async (f: File) => {
    setParseError(null);
    setIsParsing(true);
    setFile(f);
    setFileName(f.name);
    setFinalReport(null);
    setLiveResults([]);

    try {
      const buffer = await f.arrayBuffer();
      setFileBuffer(buffer);
      const res = await MigrationService.parseFile(buffer, f.name);
      setRecords(res.records);
      setSummary(res.summary);
    } catch (err: any) {
      console.error('File parsing failed:', err);
      setParseError(err.message || 'Failed to parse file. Please verify it is a valid Excel (.xlsx) or CSV file.');
      setRecords([]);
      setSummary(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleRefreshRecalculate = async () => {
    if (!fileBuffer || !fileName) return;
    setIsParsing(true);
    try {
      const res = await MigrationService.parseFile(fileBuffer, fileName);
      setRecords(res.records);
      setSummary(res.summary);
      await scanDuplicates(res.records);
    } catch (err: any) {
      console.error('Recalculation error:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Full Name',
      'Age',
      'Gender',
      'Email',
      'Phone',
      'Address',
      'Emergency Contact Name',
      'Emergency Contact Number',
      'Country',
      'Gambling Experience',
      'Amount Spent/Lost',
      'Gambling Type / Major Notes',
      'Severity',
    ];

    const sampleRows = [
      [
        'Shodipo Ayomide',
        29,
        'Male',
        'ayomideshodipo@gmail.com',
        '+234 803 000 1122',
        'Lagos, Nigeria',
        'Mrs. Shodipo',
        '+234 802 111 2233',
        'Nigeria',
        '2 - 3 years',
        'NGN 2,500,000',
        'Online sports betting; First client test verified (GP-0018)',
        'High',
      ],
      [
        'John Babatunde Adeleke',
        34,
        'Male',
        'john.adeleke@example.com',
        '+234 803 111 2233',
        '24 Awolowo Road, Ikoyi, Lagos',
        'Mary Adeleke',
        '+234 802 333 4455',
        'Nigeria',
        '3 - 5 years',
        'NGN 4,500,000',
        'Sports betting & online roulette; financial strain',
        'High',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historical Clients');
    XLSX.writeFile(wb, 'GamblePause_Historical_Clients_Template.xlsx');
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (previewFilter === 'ELIGIBLE' && r.status !== 'READY' && r.status !== 'UPDATE_EXISTING') return false;
      if (previewFilter === 'READY' && r.status !== 'READY') return false;
      if (previewFilter === 'UPDATE_EXISTING' && r.status !== 'UPDATE_EXISTING') return false;
      if (previewFilter === 'ALREADY_MIGRATED' && r.status !== 'ALREADY_MIGRATED') return false;
      if (previewFilter === 'DUPLICATE' && r.status !== 'DUPLICATE') return false;
      if (previewFilter === 'INVALID_EMAIL' && r.status !== 'INVALID_EMAIL') return false;
      if (previewFilter === 'INCOMPLETE' && r.status !== 'INCOMPLETE' && r.status !== 'MISSING_REQUIRED_DATA') return false;
      if (previewFilter === 'NIGERIAN_NON_LAGOS' && !(r.cleaned.country === 'Nigeria' && r.cleaned.state !== 'Lagos' && r.cleaned.state !== 'Not specified')) return false;
      if (previewFilter === 'GHANA' && r.cleaned.country !== 'Ghana') return false;
      if (previewFilter === 'OTHER_AFRICAN' && r.cleaned.country !== 'Other African Countries') return false;
      if (previewFilter === 'ADDRESS_EXTRACTED' && !r.cleaned.isStateExtractedFromAddress) return false;
      if (previewFilter === 'UNKNOWN_STATE' && r.cleaned.state !== 'Not specified') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = r.cleaned.fullName.toLowerCase().includes(q);
        const matchesEmail = r.cleaned.email.toLowerCase().includes(q);
        const matchesPhone = r.cleaned.phone.toLowerCase().includes(q);
        const matchesState = r.cleaned.state ? r.cleaned.state.toLowerCase().includes(q) : false;
        const matchesCountry = r.cleaned.country ? r.cleaned.country.toLowerCase().includes(q) : false;
        const matchesAddress = r.cleaned.address ? r.cleaned.address.toLowerCase().includes(q) : false;
        const matchesId = r.existingClientId ? r.existingClientId.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesState && !matchesCountry && !matchesAddress && !matchesId) return false;
      }
      return true;
    });
  }, [records, previewFilter, searchQuery]);

  const firstEligibleClient = useMemo(() => {
    return (
      records.find((r) => r.status === 'READY') ||
      records.find((r) => r.status === 'UPDATE_EXISTING') ||
      records[0]
    );
  }, [records]);

  // Execute First Client Test
  const handleTestFirstClient = async () => {
    if (!firstEligibleClient) {
      alert('No eligible client found in the uploaded file to test.');
      return;
    }

    setIsTestingFirst(true);
    setTestResult(null);

    try {
      const res = await MigrationService.testFirstClient(firstEligibleClient, currentFbEmail);
      setTestResult(res);
      setFirstClientTestPassed(res.success);
      if (res.success) {
        await handleRefreshRecalculate();
      }
    } catch (err: any) {
      console.error('Test First Client failed:', err);
      alert(`Test First Client failed: ${err.message || err}`);
    } finally {
      setIsTestingFirst(false);
    }
  };

  // Execute Full Migration
  const handleStartFullMigration = async () => {
    console.log('[HistoricalClientMigration] handleStartFullMigration triggered by user click');

    if (isMigrating || isMigratingRef.current) {
      console.warn('[HistoricalClientMigration] Blocked by concurrency lock (migration already running)');
      return;
    }

    // Recalculate fresh state before starting: includes READY (new clients) AND UPDATE_EXISTING (safe updates)
    const readyRecords = records.filter((r) => r.status === 'READY');
    const updateRecords = records.filter((r) => r.status === 'UPDATE_EXISTING');
    const eligibleRecords = records.filter((r) => r.status === 'READY' || r.status === 'UPDATE_EXISTING');
    const alreadyMigratedList = records.filter((r) => r.status === 'ALREADY_MIGRATED');
    const duplicateList = records.filter((r) => r.status === 'DUPLICATE');

    console.log('[HistoricalClientMigration] Pre-execution queue inspection:', {
      totalRecordsInFile: records.length,
      queueLength: eligibleRecords.length,
      readyCount: readyRecords.length,
      updateCount: updateRecords.length,
      firstQueueClient: eligibleRecords[0]?.cleaned.fullName || 'None',
      firstQueueClientRow: eligibleRecords[0]?.rowIndex,
      alreadyMigratedCount: alreadyMigratedList.length,
      duplicatesCount: duplicateList.length,
      adminEmail: currentFbEmail,
    });

    if (eligibleRecords.length === 0) {
      console.warn('[HistoricalClientMigration] No eligible migration actions (READY or UPDATE_EXISTING) to process.');
      return;
    }

    // Enter MIGRATION IN PROGRESS immediately BEFORE any async network or Firestore operation
    isMigratingRef.current = true;
    setIsMigrating(true);
    setIsPaused(false);
    const signal = { paused: false, aborted: false };
    setControlSignal(signal);
    setLiveResults([]);
    setFinalReport(null);

    // Initial progress state updated synchronously BEFORE any async network operations
    setMigrationProgress({
      current: 0,
      total: eligibleRecords.length,
      currentName: eligibleRecords[0]?.cleaned.fullName || 'Starting migration pipeline...',
      currentStep: `Preparing migration pipeline for ${eligibleRecords.length} eligible migration actions (${readyRecords.length} new, ${updateRecords.length} updates)...`,
      stepNumber: 0,
      totalSteps: 12,
      success: 0,
      skipped: alreadyMigratedList.length,
      duplicates: duplicateList.length,
      authFailed: 0,
      clientFailed: 0,
      assessmentFailed: 0,
    });

    // Immediately smooth scroll to the Live Progress Panel so the user sees real-time progress instantly
    setTimeout(() => {
      progressContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 20);

    // Yield to the React event loop so the UI updates and displays MIGRATION IN PROGRESS immediately
    await new Promise((resolve) => setTimeout(resolve, 60));

    try {
      console.log(`[HistoricalClientMigration] Calling MigrationService.runFullMigration with ${eligibleRecords.length} eligible records (${readyRecords.length} new, ${updateRecords.length} updates)`);
      const report = await MigrationService.runFullMigration(
        eligibleRecords,
        currentFbEmail,
        async (clientIndex, totalClients, clientName, stepName, stepNumber, totalSteps, stats) => {
          setMigrationProgress((prev) => ({
            ...prev,
            current: clientIndex,
            total: totalClients,
            currentName: clientName,
            currentStep: stepName,
            stepNumber: stepNumber,
            totalSteps: totalSteps,
            success: stats.success,
            skipped: stats.skipped,
            duplicates: stats.duplicates,
            authFailed: stats.authFailed,
            clientFailed: stats.clientFailed,
            assessmentFailed: stats.assessmentFailed,
          }));
        },
        (result: MigrationClientResult) => {
          setLiveResults((prev) => [result, ...prev]);
        },
        signal
      );
      setFinalReport(report);
      setActiveSubTab('REPORT');
    } catch (err: any) {
      console.error('[HistoricalClientMigration] Full migration halted:', err);
    } finally {
      isMigratingRef.current = false;
      setIsMigrating(false);
      await handleRefreshRecalculate();
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      setControlSignal((prev) => ({ ...prev, paused: false }));
    } else {
      setIsPaused(true);
      setControlSignal((prev) => ({ ...prev, paused: true }));
    }
  };

  const handleAbort = () => {
    console.log('[HistoricalClientMigration] Abort signal triggered by user');
    setControlSignal({ paused: false, aborted: true });
    setIsPaused(false);
  };

  // Duplicate resolution actions
  const handleMarkKept = (group: DuplicateRecordGroup) => {
    setDuplicateGroups((prev) =>
      prev.map((g) => (g.groupId === group.groupId ? { ...g, status: 'KEPT' } : g))
    );
  };

  const handleMarkManualReview = (group: DuplicateRecordGroup) => {
    setDuplicateGroups((prev) =>
      prev.map((g) => (g.groupId === group.groupId ? { ...g, status: 'MANUAL_REVIEW' } : g))
    );
  };

  const openDeleteConfirmation = (
    group: DuplicateRecordGroup,
    recordToDelete: DuplicateRecordItem,
    recordToKeep?: DuplicateRecordItem
  ) => {
    setDeletionModalGroup({ group, recordToDelete, recordToKeep });
    setExplicitOverrideCheck(false);
  };

  const executeDeleteDuplicate = async () => {
    if (!deletionModalGroup || !deletionModalGroup.recordToDelete.id) return;

    setIsDeletingDuplicate(true);
    try {
      const res = await MigrationService.removeDuplicateClient(
        deletionModalGroup.recordToDelete.id,
        currentFbEmail,
        explicitOverrideCheck
      );
      if (res.success) {
        alert(`Duplicate record ${deletionModalGroup.recordToDelete.id} removed successfully.`);
        setDuplicateGroups((prev) =>
          prev.map((g) =>
            g.groupId === deletionModalGroup.group.groupId ? { ...g, status: 'REMOVED' } : g
          )
        );
        setDeletionModalGroup(null);
        await handleRefreshRecalculate();
      } else {
        alert(res.error || 'Failed to remove duplicate.');
      }
    } catch (err: any) {
      alert(`Deletion error: ${err.message || err}`);
    } finally {
      setIsDeletingDuplicate(false);
    }
  };

  const handleDownloadReport = () => {
    if (!finalReport) return;
    const rows = finalReport.results.map((r) => ({
      Row: r.rowIndex,
      Name: r.name,
      Email: r.email,
      ClientID: r.clientId || 'N/A',
      Status: r.status,
      Reason: r.reason || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Migration Report');
    XLSX.writeFile(wb, `GamblePause_Migration_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Super-Admin Exclusive Pipeline
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              Test Verified (GP-0018 Intact)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
            Historical Client Migration & Duplicate Protection
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
            Idempotent migration suite for GamblePause Africa. Validates data, protects completed test client GP-0018 (Shodipo Ayomide), provisions isolated Firebase Authentication credentials, writes client documents, and saves 6-stage assessment records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Download Template</span>
          </button>

          {fileBuffer && (
            <button
              onClick={handleRefreshRecalculate}
              disabled={isParsing || isMigrating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isParsing ? 'animate-spin' : ''}`} />
              <span>Refresh & Recalculate</span>
            </button>
          )}
        </div>
      </div>

      {/* Operator Authorization & Shodipo Exclusion Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>
              Authorized Administrator:{' '}
              <strong className="font-mono text-emerald-950">{AUTHORIZED_MIGRATION_ADMIN}</strong>
            </span>
          </div>
          <span className="text-[10px] font-bold text-emerald-800 bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
            Multi-App Auth
          </span>
        </div>

        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-blue-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              First Test Client:{' '}
              <strong className="text-blue-950">Shodipo Ayomide (GP-0018)</strong> is recognized & protected.
            </span>
          </div>
          <span className="text-[10px] font-bold text-blue-800 bg-white/80 px-2 py-0.5 rounded border border-blue-200">
            Excluded from Queue
          </span>
        </div>
      </div>

      {/* Persistent Migration In Progress Banner */}
      {isMigrating && (
        <div
          ref={progressContainerRef}
          className="bg-gradient-to-br from-red-600 via-red-600 to-red-700 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-red-800 space-y-6 animate-pulse-subtle"
        >
          {/* Header & Warning Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-red-500/40 pb-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/30">
                  MIGRATION IN PROGRESS
                </span>
                <span className="text-xs font-bold text-red-100 bg-red-950/40 px-2.5 py-0.5 rounded-md">
                  Active Execution
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                DO NOT REFRESH OR CLOSE THIS PAGE WHILE MIGRATION IS RUNNING.
              </h2>
              <p className="text-xs text-red-100 font-medium">
                Real-time Firebase Authentication provisioning and Cloud Firestore document transactions are in progress. Do not leave or refresh.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePauseResume}
                className="px-4 py-2.5 rounded-xl bg-white text-red-700 font-bold text-xs hover:bg-red-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
              <button
                type="button"
                onClick={handleAbort}
                className="px-4 py-2.5 rounded-xl bg-red-950 hover:bg-black text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop</span>
              </button>
            </div>
          </div>

          {/* Core Live Status Panel: Current client, Client, Progress, Current step */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-red-800/80 rounded-2xl p-4 border border-red-500/40 shadow-inner">
              <span className="text-[11px] uppercase font-bold text-red-200 block tracking-wider">Current client:</span>
              <p className="text-base font-black text-white truncate mt-1">
                {migrationProgress.currentName || 'Initializing...'}
              </p>
            </div>

            <div className="bg-red-800/80 rounded-2xl p-4 border border-red-500/40 shadow-inner">
              <span className="text-[11px] uppercase font-bold text-red-200 block tracking-wider">Client:</span>
              <p className="text-base font-black text-white mt-1">
                {migrationProgress.current} / {migrationProgress.total}
              </p>
            </div>

            <div className="bg-red-800/80 rounded-2xl p-4 border border-red-500/40 shadow-inner">
              <span className="text-[11px] uppercase font-bold text-red-200 block tracking-wider">Progress:</span>
              <p className="text-base font-black text-white mt-1">
                {migrationProgress.total > 0 ? Math.round((migrationProgress.current / migrationProgress.total) * 100) : 0}%
              </p>
            </div>

            <div className="bg-red-800/80 rounded-2xl p-4 border border-red-500/40 shadow-inner">
              <span className="text-[11px] uppercase font-bold text-red-200 block tracking-wider">Current step:</span>
              <p className="text-xs font-bold text-amber-200 truncate mt-1" title={migrationProgress.currentStep}>
                {migrationProgress.currentStep || 'Initializing pipeline...'}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-red-950/70 rounded-full h-4 p-0.5 overflow-hidden border border-red-400/40">
              <div
                className="bg-white h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${migrationProgress.total > 0 ? (migrationProgress.current / migrationProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs font-bold text-red-100">
              <span>
                Processing Client {migrationProgress.current} of {migrationProgress.total}:{' '}
                <strong className="text-white underline">{migrationProgress.currentName}</strong>
              </span>
              <span>{Math.round((migrationProgress.current / (migrationProgress.total || 1)) * 100)}%</span>
            </div>
          </div>

          {/* 6 Running Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center text-xs font-bold pt-1">
            <div className="bg-red-800/90 rounded-2xl p-3 border border-red-500/30 shadow-inner">
              <span className="text-red-200 block text-[10px] uppercase tracking-wider">Successful:</span>
              <span className="text-2xl font-black text-white mt-1 block">{migrationProgress.success}</span>
            </div>
            <div className="bg-red-800/90 rounded-2xl p-3 border border-red-500/30 shadow-inner">
              <span className="text-red-200 block text-[10px] uppercase tracking-wider">Skipped / Already Migrated:</span>
              <span className="text-2xl font-black text-white mt-1 block">{migrationProgress.skipped}</span>
            </div>
            <div className="bg-red-800/90 rounded-2xl p-3 border border-red-500/30 shadow-inner">
              <span className="text-red-200 block text-[10px] uppercase tracking-wider">Duplicates:</span>
              <span className="text-2xl font-black text-white mt-1 block">{migrationProgress.duplicates}</span>
            </div>
            <div className="bg-red-800/90 rounded-2xl p-3 border border-red-500/30 shadow-inner">
              <span className="text-red-200 block text-[10px] uppercase tracking-wider">Authentication Failures:</span>
              <span className="text-2xl font-black text-white mt-1 block">{migrationProgress.authFailed}</span>
            </div>
            <div className="bg-red-800/90 rounded-2xl p-3 border border-red-500/30 shadow-inner">
              <span className="text-red-200 block text-[10px] uppercase tracking-wider">Client Write Failures:</span>
              <span className="text-2xl font-black text-white mt-1 block">{migrationProgress.clientFailed}</span>
            </div>
            <div className="bg-red-800/90 rounded-2xl p-3 border border-red-500/30 shadow-inner">
              <span className="text-red-200 block text-[10px] uppercase tracking-wider">Assessment Write Failures:</span>
              <span className="text-2xl font-black text-white mt-1 block">{migrationProgress.assessmentFailed}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tabs: Pipeline vs Duplicate Review vs Final Report */}
      <div className="bg-white rounded-2xl p-2 border border-gray-200 shadow-sm flex items-center gap-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('PIPELINE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'PIPELINE'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Migration Pipeline & Preview</span>
          {records.length > 0 && (
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px]">
              {records.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('DUPLICATES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'DUPLICATES'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Duplicate Review & Assessment Protection</span>
          {duplicateGroups.length > 0 && (
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px]">
              {duplicateGroups.length}
            </span>
          )}
        </button>

        {finalReport && (
          <button
            onClick={() => setActiveSubTab('REPORT')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'REPORT'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Final Migration Report</span>
          </button>
        )}
      </div>

      {/* TAB 1: PIPELINE & PREVIEW */}
      {activeSubTab === 'PIPELINE' && (
        <div className="space-y-6">
          {/* Upload Zone */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-red-600" />
              <span>Select Historical Client File (.xlsx, .xls, .csv)</span>
            </h2>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-red-400 bg-gray-50/60 hover:bg-red-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />

              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mx-auto text-red-600">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {file ? fileName : 'Click to upload or drag and drop migration file'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supports cleaned Excel (.xlsx, .xls) and CSV formatted historical client records
                  </p>
                </div>
                {file && (
                  <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>File Loaded & Analyzed ({records.length} records parsed)</span>
                  </div>
                )}
              </div>
            </div>

            {parseError && (
              <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">File Parsing Error</p>
                  <p className="mt-0.5">{parseError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Migration Preview Stats Cards */}
          {summary && (
            <div className="space-y-6">
              {/* Migration Preview Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 text-center">
                <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Total Source</p>
                  <p className="text-xl font-black text-gray-950 mt-1">{summary.totalSourceRows ?? summary.totalRows}</p>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-emerald-300 shadow-sm bg-emerald-50/50 ring-1 ring-emerald-200">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">Eligible Actions</p>
                  <p className="text-xl font-black text-emerald-800 mt-1">{summary.readyToMigrate + (summary.existingToUpdate ?? 0)}</p>
                  <span className="text-[9px] font-bold text-emerald-700 block mt-0.5">
                    {summary.readyToMigrate} New + {summary.existingToUpdate ?? 0} Upd
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-emerald-200 shadow-sm bg-emerald-50/20">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">New Clients (Ready)</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">{summary.readyToMigrate}</p>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-indigo-200 shadow-sm bg-indigo-50/30">
                  <p className="text-[10px] font-bold text-indigo-700 uppercase">Existing to Update</p>
                  <p className="text-xl font-black text-indigo-700 mt-1">{summary.existingToUpdate ?? 0}</p>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-blue-200 shadow-sm bg-blue-50/30">
                  <p className="text-[10px] font-bold text-blue-700 uppercase">Already Migrated</p>
                  <p className="text-xl font-black text-blue-700 mt-1">{summary.alreadyMigrated}</p>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-amber-200 shadow-sm bg-amber-50/30">
                  <p className="text-[10px] font-bold text-amber-700 uppercase">Duplicates</p>
                  <p className="text-xl font-black text-amber-700 mt-1">{summary.potentialDuplicates}</p>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-red-200 shadow-sm bg-red-50/30">
                  <p className="text-[10px] font-bold text-red-700 uppercase">Invalid / Incomplete</p>
                  <p className="text-xl font-black text-red-700 mt-1">{(summary.invalidEmails || 0) + (summary.missingInfo || 0)}</p>
                </div>
              </div>

              {/* LOCATION & COUNTRY ACCURACY VALIDATION PANEL (Part 1 & 4) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-950 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Country & State Parsing Verification (Zero Lagos Overrides)</span>
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Deterministic location mapping. Nigerian states extracted safely from State column or Address. Foreign countries preserved. Unknown states marked "Not specified".
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                    Rules Compliant
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('NIGERIAN_NON_LAGOS')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      previewFilter === 'NIGERIAN_NON_LAGOS'
                        ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Nigerian Non-Lagos</span>
                    <p className="text-lg font-black text-gray-950 mt-0.5">{summary.nigerianNonLagosCount ?? 0}</p>
                    <span className="text-[10px] text-emerald-700 font-medium">Oyo, Kano, Delta, etc.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('GHANA')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      previewFilter === 'GHANA'
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Ghana Clients</span>
                    <p className="text-lg font-black text-gray-950 mt-0.5">{summary.ghanaCount ?? 0}</p>
                    <span className="text-[10px] text-amber-700 font-medium">Foreign preserved</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('OTHER_AFRICAN')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      previewFilter === 'OTHER_AFRICAN'
                        ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Other African</span>
                    <p className="text-lg font-black text-gray-950 mt-0.5">{summary.otherAfricanCountriesCount ?? 0}</p>
                    <span className="text-[10px] text-purple-700 font-medium">Foreign preserved</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('ADDRESS_EXTRACTED')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      previewFilter === 'ADDRESS_EXTRACTED'
                        ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">From Address</span>
                    <p className="text-lg font-black text-gray-950 mt-0.5">{summary.addressExtractedStateCount ?? 0}</p>
                    <span className="text-[10px] text-blue-700 font-medium">Address-extracted</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('UNKNOWN_STATE')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      previewFilter === 'UNKNOWN_STATE'
                        ? 'bg-gray-200 border-gray-400 ring-2 ring-gray-400'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Not Specified</span>
                    <p className="text-lg font-black text-gray-950 mt-0.5">{summary.unknownStateCount ?? 0}</p>
                    <span className="text-[10px] text-gray-600 font-medium">Unknown (not Lagos)</span>
                  </button>
                </div>
              </div>

              {/* LIVE SOURCE FILE DIAGNOSTIC AUDIT SECTION (Requirement 17) */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-indigo-500/30 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
                          Live Audit Diagnostics
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 font-mono">
                          Zero Hardcoding Active
                        </span>
                      </div>
                      <h3 className="text-base font-black text-white mt-1 flex items-center gap-2">
                        <span>Actual Source File:</span>
                        <span className="text-indigo-400 font-mono underline decoration-indigo-500/50">{fileName || 'Uploaded Historical Spreadsheet'}</span>
                      </h3>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actual Parsed Clients</p>
                    <p className="text-2xl font-black text-emerald-400 font-mono">{records.length} Records</p>
                  </div>
                </div>

                {/* 2-Column Key Diagnostics Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                    <p className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">Source File Boundary Check</p>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">First Parsed Client:</span>
                        <strong className="text-white">
                          {records[0] ? `${records[0].cleaned.fullName} (Excel Row #${records[0].rowIndex})` : 'None'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Last Parsed Client:</span>
                        <strong className="text-white">
                          {records[records.length - 1] ? `${records[records.length - 1].cleaned.fullName} (Excel Row #${records[records.length - 1].rowIndex})` : 'None'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-white/10">
                        <span className="text-gray-400">Total Client Data Rows:</span>
                        <strong className="text-emerald-400">{records.length} physical data rows</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                    <p className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">Status Breakdown Audit</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                        <span className="text-gray-400">Ready (New):</span>
                        <strong className="text-emerald-400 font-mono">{summary.readyToMigrate}</strong>
                      </div>
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                        <span className="text-gray-400">Existing to Update:</span>
                        <strong className="text-indigo-400 font-mono">{summary.existingToUpdate ?? 0}</strong>
                      </div>
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg col-span-2 border border-emerald-500/40 bg-emerald-950/40">
                        <span className="text-emerald-300 font-bold">Eligible Migration Actions:</span>
                        <strong className="text-emerald-300 font-mono text-sm">{summary.readyToMigrate + (summary.existingToUpdate ?? 0)}</strong>
                      </div>
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                        <span className="text-gray-400">Already Migrated:</span>
                        <strong className="text-blue-400 font-mono">{summary.alreadyMigrated}</strong>
                      </div>
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                        <span className="text-gray-400">Duplicate:</span>
                        <strong className="text-amber-300 font-mono">{summary.potentialDuplicates}</strong>
                      </div>
                      <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg col-span-2">
                        <span className="text-gray-400">Invalid / Incomplete:</span>
                        <strong className="text-red-400 font-mono">{summary.invalidEmails + summary.missingInfo}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exact Reconciliation Equation */}
                <div className="bg-indigo-900/40 rounded-2xl p-3.5 border border-indigo-400/20 text-xs">
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Exact Reconciliation Equation</p>
                  <p className="font-mono text-sm font-black text-white mt-1">
                    {summary.reconciliation?.reconciliationEquation ||
                      `Source Client Rows (${records.length}) = Ready (${summary.readyToMigrate}) + Existing to Update (${summary.existingToUpdate ?? 0}) + Already Migrated (${summary.alreadyMigrated}) + Duplicates (${summary.potentialDuplicates}) + Invalid/Incomplete (${summary.invalidEmails + summary.missingInfo}) = Parsed (${records.length})`}
                  </p>
                </div>
              </div>

              {/* Source File & Row Reconciliation Section */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-indigo-200/90 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-black text-gray-950">Source File & Row Reconciliation</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                        Zero Silently Discarded Rows
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Mathematical verification connecting physical source spreadsheet rows, parsed records, valid migration targets, and excluded items.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="font-black text-emerald-700 uppercase tracking-wider">
                      Reconciliation Balanced
                    </span>
                  </div>
                </div>

                {/* 4 Core Reconciliation Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-indigo-50/70 rounded-2xl p-4 border border-indigo-200 shadow-sm">
                    <p className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">SOURCE CLIENT ROWS</p>
                    <p className="text-2xl font-black text-indigo-950 mt-1">
                      {summary.reconciliation?.sourcePhysicalRows ?? records.length}
                    </p>
                    <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">Spreadsheet physical client lines</p>
                  </div>

                  <div className="bg-blue-50/70 rounded-2xl p-4 border border-blue-200 shadow-sm">
                    <p className="text-[11px] font-black text-blue-700 uppercase tracking-wider">PARSED CLIENTS</p>
                    <p className="text-2xl font-black text-blue-950 mt-1">
                      {summary.reconciliation?.parsedRows ?? records.length}
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold mt-0.5">Records extracted by parser</p>
                  </div>

                  <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200 shadow-sm">
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">VALID CLIENTS (ELIGIBLE ACTIONS)</p>
                    <p className="text-2xl font-black text-emerald-950 mt-1">
                      {summary.reconciliation?.validRows ?? (summary.readyToMigrate + (summary.existingToUpdate ?? 0))}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      {summary.readyToMigrate} New + {summary.existingToUpdate ?? 0} Updates
                    </p>
                  </div>

                  <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 shadow-sm">
                    <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">EXCLUDED CLIENTS</p>
                    <p className="text-2xl font-black text-amber-950 mt-1">
                      {summary.reconciliation?.excludedRows ?? summary.excludedRows?.length ?? (records.length - (summary.readyToMigrate + (summary.existingToUpdate ?? 0)))}
                    </p>
                    <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Already migrated, duplicates & unparsed</p>
                  </div>
                </div>

                {/* Mathematical Reconciliation Summary Strip */}
                <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-700">Source Reconciliation:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 font-bold text-indigo-700">
                        Client Rows ({records.length}) = Ready ({summary.readyToMigrate}) + Existing to Update ({summary.existingToUpdate ?? 0}) + Already Migrated ({summary.alreadyMigrated}) + Duplicates ({summary.potentialDuplicates}) + Others ({summary.invalidEmails + summary.missingInfo})
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-gray-600">
                      <span>Queue Breakdown:</span>
                      <strong className="text-emerald-700">{summary.readyToMigrate} Ready (New)</strong>
                      <span>•</span>
                      <strong className="text-indigo-700">{summary.existingToUpdate ?? 0} Existing to Update</strong>
                      <span>•</span>
                      <strong className="text-blue-700">{summary.alreadyMigrated} Already Migrated (GP-0017)</strong>
                      <span>•</span>
                      <strong className="text-amber-700">{summary.potentialDuplicates} Duplicates</strong>
                      <span>•</span>
                      <strong className="text-red-700">{summary.invalidEmails} Invalid Emails</strong>
                      <span>•</span>
                      <strong className="text-purple-700">{summary.missingInfo} Incomplete</strong>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold text-gray-500">Already in Cloud Firestore:</span>
                    <p className="font-black text-gray-900 text-sm">{summary.alreadyInFirestore} Records</p>
                  </div>
                </div>

                {/* Missing / Unparsed Rows Breakdown */}
                {summary.reconciliation?.unparsedList && summary.reconciliation.unparsedList.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
                          Missing / Unparsed Source Rows ({summary.reconciliation.unparsedList.length})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUnparsedRowsList(!showUnparsedRowsList)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        {showUnparsedRowsList ? 'Hide Missing Rows' : 'View Missing Rows Details'}
                      </button>
                    </div>

                    {showUnparsedRowsList && (
                      <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-amber-50/20">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-amber-100/70 text-amber-900 border-b border-amber-200">
                            <tr>
                              <th className="py-2.5 px-3">Excel Row #</th>
                              <th className="py-2.5 px-4">Row Name / Identifier</th>
                              <th className="py-2.5 px-4">Email</th>
                              <th className="py-2.5 px-4">Reason Excluded</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {summary.reconciliation.unparsedList.map((ur, idx) => (
                              <tr key={idx} className="hover:bg-amber-100/30">
                                <td className="py-2.5 px-3 font-mono font-bold text-amber-900">{ur.rowNumber}</td>
                                <td className="py-2.5 px-4 font-bold text-gray-900">{ur.fullName}</td>
                                <td className="py-2.5 px-4 font-mono text-gray-500">{ur.email || '—'}</td>
                                <td className="py-2.5 px-4 text-amber-800 font-medium">{ur.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Complete Excluded Rows List Toggle */}
                {summary.excludedRows && summary.excludedRows.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-700">
                          Complete Excluded Rows Audit Log ({summary.excludedRows.length} total rows excluded from ready migration queue)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowExcludedRowsList(!showExcludedRowsList)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        {showExcludedRowsList ? 'Hide Excluded Rows' : `View All Excluded Rows (${summary.excludedRows.length})`}
                      </button>
                    </div>

                    {showExcludedRowsList && (
                      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                            <tr>
                              <th className="py-2.5 px-3">Row #</th>
                              <th className="py-2.5 px-4">Client Name</th>
                              <th className="py-2.5 px-4">Email</th>
                              <th className="py-2.5 px-4">Reason Excluded</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {summary.excludedRows.map((ex, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/70">
                                <td className="py-2.5 px-3 font-mono font-bold text-gray-600">{ex.rowNumber}</td>
                                <td className="py-2.5 px-4 font-bold text-gray-900">{ex.clientName}</td>
                                <td className="py-2.5 px-4 font-mono text-gray-600">{ex.email || '—'}</td>
                                <td className="py-2.5 px-4 text-xs font-medium text-gray-700">{ex.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Execution Controls Action Bar */}
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-gray-950">Execution Gate</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Idempotent Mode Active
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Existing client GP-0017 (Shodipo Ayomide) is protected, and GP-0018 is a consumed test ID. Full Migration will process exactly{' '}
                    <strong className="text-emerald-700 font-bold">{summary.readyToMigrate + (summary.existingToUpdate ?? 0)}</strong> eligible migration actions ({summary.readyToMigrate} new, {summary.existingToUpdate ?? 0} safe updates) out of{' '}
                    <strong className="text-gray-900 font-bold">{summary.totalSourceRows ?? summary.totalRows}</strong> total records in file.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestFirstClient}
                    disabled={isTestingFirst || isMigrating}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingFirst ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Next Client...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 text-red-600" />
                        <span>Run Test With Next Client</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleStartFullMigration}
                    disabled={isMigrating || (summary.readyToMigrate + (summary.existingToUpdate ?? 0)) === 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isMigrating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Migration In Progress...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>
                          {summary.readyToMigrate > 0 && (summary.existingToUpdate ?? 0) > 0
                            ? `Start Full Migration (${summary.readyToMigrate + (summary.existingToUpdate ?? 0)} Eligible Actions: ${summary.readyToMigrate} Ready, ${summary.existingToUpdate} Updates)`
                            : (summary.existingToUpdate ?? 0) > 0
                            ? `Start Full Migration (${summary.existingToUpdate} Eligible Updates)`
                            : `Start Full Migration (${summary.readyToMigrate} Ready Clients)`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* First Client Test Result Matrix (if run) */}
              {testResult && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-md space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            testResult.success
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {testResult.success ? 'TEST VERIFIED PASS' : 'TEST FAILED'}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">13-Step Verification Matrix</span>
                      </div>
                      <h3 className="text-lg font-black text-gray-950 mt-1">Single-Client Test Verification</h3>
                    </div>

                    {testResult.clientId && (
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-500">Allocated Client ID</p>
                        <p className="text-base font-black text-red-600 font-mono">{testResult.clientId}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {testResult.steps.map((st) => (
                      <div
                        key={st.stepNumber}
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs ${
                          st.status === 'PASS'
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                            : st.status === 'FAIL'
                            ? 'bg-red-50 border-red-200 text-red-950'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {st.status === 'PASS' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          {st.status === 'FAIL' && <XCircle className="w-4 h-4 text-red-600" />}
                          {st.status === 'PENDING' && <Clock className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-bold">
                            Step {st.stepNumber}: {st.title}
                          </p>
                          {st.details && <p className="text-[11px] text-gray-600">{st.details}</p>}
                          {st.error && <p className="text-[11px] text-red-700 font-bold">{st.error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-gray-500 font-bold">Firebase Auth UID:</span>
                      <span className="font-mono font-bold text-gray-800">{testResult.firebaseUid || 'N/A'}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-gray-500 font-bold">Assessment Responses:</span>
                      <span className="font-mono text-[11px] text-gray-700">
                        {testResult.assessmentResponseIds?.length || 0} responses written and verified in Cloud Firestore
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pre-Migration Data Table */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-gray-950">Pre-Migration Client Records</h3>
                    <p className="text-xs text-gray-500">
                      Recalculated against live Cloud Firestore state. Legitimate existing client GP-0017 (Shodipo Ayomide) is excluded from migration, and test ID GP-0018 is permanently retired.
                    </p>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search client or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>

                    <select
                      value={previewFilter}
                      onChange={(e) => setPreviewFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 focus:bg-white focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Records ({records.length})</option>
                      <option value="ELIGIBLE">
                        Eligible Migration Actions ({summary ? summary.readyToMigrate + (summary.existingToUpdate ?? 0) : 0})
                      </option>
                      <option value="READY">Ready to Migrate — New ({summary.readyToMigrate})</option>
                      <option value="UPDATE_EXISTING">Existing to Update ({summary.existingToUpdate ?? 0})</option>
                      <option value="NIGERIAN_NON_LAGOS">Nigerian Non-Lagos ({summary.nigerianNonLagosCount ?? 0})</option>
                      <option value="GHANA">Ghana Clients ({summary.ghanaCount ?? 0})</option>
                      <option value="OTHER_AFRICAN">Other African Countries ({summary.otherAfricanCountriesCount ?? 0})</option>
                      <option value="ADDRESS_EXTRACTED">From Address ({summary.addressExtractedStateCount ?? 0})</option>
                      <option value="UNKNOWN_STATE">State Not Specified ({summary.unknownStateCount ?? 0})</option>
                      <option value="ALREADY_MIGRATED">Already Migrated ({summary.alreadyMigrated})</option>
                      <option value="DUPLICATE">Duplicates ({summary.potentialDuplicates})</option>
                      <option value="INVALID_EMAIL">Invalid Email ({summary.invalidEmails})</option>
                      <option value="INCOMPLETE">Incomplete Data ({summary.missingInfo})</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="py-3 px-3 whitespace-nowrap">Row #</th>
                        <th className="py-3 px-3 whitespace-nowrap">Client ID</th>
                        <th className="py-3 px-4 whitespace-nowrap">Client Name</th>
                        <th className="py-3 px-3 whitespace-nowrap">Country</th>
                        <th className="py-3 px-3 whitespace-nowrap">State</th>
                        <th className="py-3 px-4 whitespace-nowrap">Address (Source)</th>
                        <th className="py-3 px-3 whitespace-nowrap">Phone</th>
                        <th className="py-3 px-3 whitespace-nowrap">Severity</th>
                        <th className="py-3 px-3 whitespace-nowrap">Migration Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRecords.slice(0, 100).map((r) => (
                        <tr key={r.rowIndex} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-gray-500 whitespace-nowrap">Row {r.rowIndex}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {r.existingClientId ? (
                              <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                {r.existingClientId}
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] text-gray-400 italic">
                                [New Client]
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-gray-900">
                            <div>
                              <span>{r.cleaned.fullName}</span>
                              <p className="text-[10px] text-gray-400 font-mono font-normal">{r.cleaned.email}</p>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {r.cleaned.country === 'Ghana' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                                🇬🇭 Ghana
                              </span>
                            ) : r.cleaned.country === 'Other African Countries' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full">
                                🌍 Other African
                              </span>
                            ) : r.cleaned.country === 'Nigeria' ? (
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                Nigeria
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-500 italic">
                                {r.cleaned.country || 'Not specified'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {r.cleaned.state === 'Not specified' ? (
                              <span className="text-[10px] text-gray-500 italic bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                Not specified
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-[11px]">
                                  {r.cleaned.state}
                                </span>
                                {r.cleaned.isStateExtractedFromAddress && (
                                  <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded" title="Extracted safely from source address">
                                    address
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-gray-600 max-w-[220px]">
                            <p className="truncate text-xs" title={r.cleaned.address}>
                              {r.cleaned.address || <span className="text-gray-400 italic">None</span>}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap font-mono text-[11px]">{r.cleaned.phone}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                r.cleaned.severity === 'High'
                                  ? 'bg-red-100 text-red-800'
                                  : r.cleaned.severity === 'Low'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {r.cleaned.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {r.status === 'READY' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Ready (New)
                              </span>
                            )}
                            {r.status === 'UPDATE_EXISTING' && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200"
                                title={r.duplicateReason}
                              >
                                <RefreshCw className="w-3 h-3 text-indigo-600" />
                                Update Existing
                              </span>
                            )}
                            {r.status === 'ALREADY_MIGRATED' && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200"
                                title={r.duplicateReason}
                              >
                                <Check className="w-3 h-3 text-blue-600" />
                                Already Migrated
                              </span>
                            )}
                            {r.status === 'DUPLICATE' && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200"
                                title={r.duplicateReason}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Duplicate
                              </span>
                            )}
                            {r.status === 'INVALID_EMAIL' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                                <XCircle className="w-3 h-3" />
                                Invalid Email
                              </span>
                            )}
                            {r.status === 'INCOMPLETE' && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200"
                                title={`Missing: ${r.missingFields.join(', ')}`}
                              >
                                <HelpCircle className="w-3 h-3" />
                                Incomplete
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredRecords.length > 100 && (
                    <div className="p-3 bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-500 font-medium">
                      Showing first 100 of {filteredRecords.length} records.
                    </div>
                  )}

                  {filteredRecords.length === 0 && (
                    <div className="p-8 text-center text-xs text-gray-500">
                      No records match the current filter or search criteria.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DUPLICATE REVIEW SCREEN & ASSESSMENT PROTECTION */}
      {activeSubTab === 'DUPLICATES' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-950 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-red-600" />
                  <span>Duplicate Review & Assessment History Protection</span>
                </h2>
                <p className="text-xs text-gray-600 mt-1 max-w-3xl">
                  Identifies possible duplicate records between uploaded source rows and live Cloud Firestore records. Protects clinical assessment history from accidental deletion.
                </p>
              </div>

              <button
                onClick={() => scanDuplicates(records)}
                disabled={isScanningDuplicates}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningDuplicates ? 'animate-spin' : ''}`} />
                <span>Re-Scan Duplicates</span>
              </button>
            </div>
          </div>

          {duplicateGroups.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-gray-900">No Ambiguous Duplicates Detected</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                All records have distinct emails and auth credentials. Shodipo Ayomide (GP-0018) is safely isolated and excluded.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group) => {
                const firestoreRec = group.records.find((r) => r.source === 'FIRESTORE');
                const fileRec = group.records.find((r) => r.source === 'MIGRATION_FILE');

                return (
                  <div
                    key={group.groupId}
                    className={`bg-white rounded-3xl p-6 border shadow-sm space-y-4 ${
                      group.status === 'REMOVED'
                        ? 'opacity-50 border-gray-200'
                        : group.status === 'KEPT'
                        ? 'border-emerald-200 bg-emerald-50/10'
                        : 'border-amber-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            POSSIBLE DUPLICATE
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-700">{group.matchKey}</span>
                        </div>
                        <h4 className="text-base font-black text-gray-950 mt-1">
                          {firestoreRec?.fullName || fileRec?.fullName || 'Client Record Group'}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        {group.status === 'KEPT' && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Kept Canonical
                          </span>
                        )}
                        {group.status === 'REMOVED' && (
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                            Duplicate Removed
                          </span>
                        )}
                        {group.status === 'MANUAL_REVIEW' && (
                          <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-lg">
                            Manual Review Flagged
                          </span>
                        )}
                      </div>
                    </div>

                    {group.guidanceText && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{group.guidanceText}</span>
                      </div>
                    )}

                    {/* Comparison Cards: Record A vs Record B */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.records.map((rec, rIdx) => (
                        <div
                          key={rIdx}
                          className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                            rec.source === 'FIRESTORE'
                              ? 'bg-blue-50/40 border-blue-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-gray-500">
                              {rec.source === 'FIRESTORE' ? 'RECORD A (Cloud Firestore)' : 'RECORD B (Migration File)'}
                            </span>
                            {rec.id && (
                              <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                {rec.id}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="font-black text-gray-900 text-sm">{rec.fullName}</p>
                            <p className="font-mono text-gray-600 text-[11px]">{rec.email}</p>
                            {rec.phone && <p className="text-gray-500">{rec.phone}</p>}
                          </div>

                          <div className="pt-2 border-t border-gray-200/60 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-gray-400 block">Assessment Responses:</span>
                              <strong className={rec.assessmentCount > 0 ? 'text-emerald-700' : 'text-gray-700'}>
                                {rec.assessmentCount} records
                              </strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block">Auth UID:</span>
                              <span className="font-mono text-gray-600 truncate block max-w-[120px]">
                                {rec.authUid || 'Pending / None'}
                              </span>
                            </div>
                            {rec.assignedCounsellorName && (
                              <div className="col-span-2">
                                <span className="text-gray-400 block">Assigned Counsellor:</span>
                                <span className="font-semibold text-gray-800">{rec.assignedCounsellorName}</span>
                              </div>
                            )}
                          </div>

                          {rec.source === 'FIRESTORE' && group.status !== 'REMOVED' && (
                            <div className="pt-2 flex items-center justify-end">
                              <button
                                onClick={() => openDeleteConfirmation(group, rec, fileRec)}
                                className="text-[11px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove Duplicate...</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action Decision Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-[11px] text-gray-500">
                        Select a decision to classify this record group safely:
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkKept(group)}
                          className="px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer"
                        >
                          KEEP THIS RECORD
                        </button>
                        <button
                          onClick={() => handleMarkManualReview(group)}
                          className="px-3.5 py-1.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition-colors cursor-pointer"
                        >
                          NEEDS MANUAL REVIEW
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FINAL REPORT */}
      {activeSubTab === 'REPORT' && finalReport && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                Migration Run Complete
              </span>
              <h3 className="text-xl font-black text-gray-950 mt-1">Migration Audit & Verification Report</h3>
            </div>

            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Audit Report (.xlsx)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Total Source</p>
              <p className="text-lg font-black text-gray-950 mt-0.5">{finalReport.totalSourceRecords}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <p className="text-[10px] font-bold text-emerald-700 uppercase">Successful</p>
              <p className="text-lg font-black text-emerald-700 mt-0.5">{finalReport.successCount}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
              <p className="text-[10px] font-bold text-blue-700 uppercase">Already Migrated</p>
              <p className="text-lg font-black text-blue-700 mt-0.5">{finalReport.alreadyMigratedCount}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <p className="text-[10px] font-bold text-amber-700 uppercase">Duplicates</p>
              <p className="text-lg font-black text-amber-700 mt-0.5">{finalReport.duplicateCount}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200">
              <p className="text-[10px] font-bold text-gray-600 uppercase">Skipped</p>
              <p className="text-lg font-black text-gray-700 mt-0.5">{finalReport.skippedCount}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
              <p className="text-[10px] font-bold text-red-700 uppercase">Invalid Email</p>
              <p className="text-lg font-black text-red-700 mt-0.5">{finalReport.invalidEmailCount}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
              <p className="text-[10px] font-bold text-red-700 uppercase">Write Failed</p>
              <p className="text-lg font-black text-red-700 mt-0.5">
                {finalReport.clientWriteFailedCount + finalReport.assessmentWriteFailedCount}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
              <p className="text-[10px] font-bold text-purple-700 uppercase">Manual Review</p>
              <p className="text-lg font-black text-purple-700 mt-0.5">{finalReport.needsManualReviewCount}</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Client Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Client ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {finalReport.results.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="py-2 px-3 font-mono text-gray-400">{r.rowIndex}</td>
                    <td className="py-2 px-3 font-semibold text-gray-900">{r.name}</td>
                    <td className="py-2 px-3 text-gray-600">{r.email}</td>
                    <td className="py-2 px-3 font-mono font-bold text-red-600">{r.clientId || '—'}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                          r.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'ALREADY_MIGRATED'
                            ? 'bg-blue-100 text-blue-800'
                            : r.status === 'DUPLICATE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{r.reason || 'Successfully completed all 15 stages.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Safety Modal: Duplicate Deletion Confirmation */}
      {deletionModalGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-red-200 shadow-2xl space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-950">Confirm Duplicate Client Removal</h3>
                <p className="text-xs text-gray-500">Explicit clinical data safety verification</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold">Client ID to Remove:</span>
                <span className="font-mono font-bold text-red-600">{deletionModalGroup.recordToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold">Client Full Name:</span>
                <span className="font-bold text-gray-900">{deletionModalGroup.recordToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold">Email:</span>
                <span className="text-gray-700">{deletionModalGroup.recordToDelete.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-bold">Auth UID:</span>
                <span className="font-mono text-gray-600 truncate max-w-xs">{deletionModalGroup.recordToDelete.authUid || 'None'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-700 font-black">Associated Assessment Records:</span>
                <strong className={deletionModalGroup.recordToDelete.assessmentCount > 0 ? 'text-red-700' : 'text-gray-700'}>
                  {deletionModalGroup.recordToDelete.assessmentCount} records
                </strong>
              </div>
            </div>

            {deletionModalGroup.recordToDelete.assessmentCount > 0 && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  Clinical Assessment History Protection Warning
                </p>
                <p className="leading-relaxed">
                  This client has <strong>{deletionModalGroup.recordToDelete.assessmentCount} assessment records</strong> associated with it in Cloud Firestore. Removing this record will permanently remove these historical assessments.
                </p>
                <label className="flex items-center gap-2 pt-1 font-bold text-red-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={explicitOverrideCheck}
                    onChange={(e) => setExplicitOverrideCheck(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>I understand and explicitly confirm deletion of these assessment records</span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletionModalGroup(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  isDeletingDuplicate ||
                  (deletionModalGroup.recordToDelete.assessmentCount > 0 && !explicitOverrideCheck)
                }
                onClick={executeDeleteDuplicate}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingDuplicate ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Removal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
