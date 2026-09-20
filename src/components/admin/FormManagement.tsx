import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  CheckCircle2,
  AlertCircle,
  MoveUp,
  MoveDown,
  ArrowRight,
  Settings2,
  HelpCircle,
} from 'lucide-react';
import { FormDefinition, QuestionDefinition, QuestionType } from '../../types';
import { dataService } from '../../services/dataService';

interface FormManagementProps {
  onPreviewForm: (form: FormDefinition) => void;
}

export const FormManagement: React.FC<FormManagementProps> = ({ onPreviewForm }) => {
  const [forms, setForms] = useState<FormDefinition[]>(dataService.getForms());
  const [selectedForm, setSelectedForm] = useState<FormDefinition | null>(forms[0] || null);
  const [isEditingFormMeta, setIsEditingFormMeta] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionDefinition | null>(null);
  const [isNewQuestion, setIsNewQuestion] = useState(false);

  // Form metadata editing states
  const [formName, setFormName] = useState(selectedForm?.name || '');
  const [formDesc, setFormDesc] = useState(selectedForm?.description || '');
  const [formInstructions, setFormInstructions] = useState(selectedForm?.instructions || '');

  const refresh = () => {
    const updated = dataService.getForms();
    setForms(updated);
    if (selectedForm) {
      const refreshedSelected = updated.find((f) => f.id === selectedForm.id);
      setSelectedForm(refreshedSelected || updated[0] || null);
    }
  };

  const handleSelectForm = (f: FormDefinition) => {
    setSelectedForm(f);
    setFormName(f.name);
    setFormDesc(f.description);
    setFormInstructions(f.instructions || '');
    setIsEditingFormMeta(false);
    setEditingQuestion(null);
  };

  const handleSaveFormMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForm) return;

    dataService.saveForm({
      ...selectedForm,
      name: formName.trim(),
      description: formDesc.trim(),
      instructions: formInstructions.trim(),
    });

    setIsEditingFormMeta(false);
    refresh();
  };

  const handleToggleActive = (form: FormDefinition) => {
    dataService.saveForm({
      ...form,
      isActive: !form.isActive,
    });
    refresh();
  };

  const handleDuplicateForm = (form: FormDefinition) => {
    const newForm: FormDefinition = {
      ...form,
      id: `form-${Date.now()}`,
      name: `${form.name} (Copy)`,
      version: 1,
    };
    dataService.saveForm(newForm);
    refresh();
    setSelectedForm(newForm);
  };

  // Question Management
  const handleStartAddQuestion = () => {
    setIsNewQuestion(true);
    setEditingQuestion({
      id: `q-${Date.now()}`,
      text: '',
      subtext: '',
      type: 'single_choice',
      required: true,
      options: [
        { label: 'Never', value: 'never', score: 0 },
        { label: 'Sometimes', value: 'sometimes', score: 1 },
        { label: 'Often', value: 'often', score: 2 },
        { label: 'Almost Always', value: 'almost_always', score: 3 },
      ],
    });
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForm || !editingQuestion) return;

    let updatedQuestions = [...selectedForm.questions];

    if (isNewQuestion) {
      updatedQuestions.push(editingQuestion);
    } else {
      updatedQuestions = updatedQuestions.map((q) =>
        q.id === editingQuestion.id ? editingQuestion : q
      );
    }

    dataService.saveForm({
      ...selectedForm,
      questions: updatedQuestions,
    });

    setEditingQuestion(null);
    setIsNewQuestion(false);
    refresh();
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (!selectedForm) return;
    if (!confirm('Are you sure you want to delete this question?')) return;

    const updatedQuestions = selectedForm.questions.filter((q) => q.id !== questionId);
    dataService.saveForm({
      ...selectedForm,
      questions: updatedQuestions,
    });
    refresh();
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (!selectedForm) return;
    const questions = [...selectedForm.questions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const temp = questions[index];
    questions[index] = questions[targetIdx];
    questions[targetIdx] = temp;

    dataService.saveForm({
      ...selectedForm,
      questions,
    });
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Assessment Form Builder & Question Library
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure questions, response types, scoring thresholds, and instructions for each pathway stage.
          </p>
        </div>

        {selectedForm && (
          <button
            onClick={() => onPreviewForm(selectedForm)}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4 text-red-600" />
            <span>Preview Active Form</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Selector List */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Configured Assessments ({forms.length})
            </h2>

            <div className="space-y-2">
              {forms.map((f) => {
                const isSelected = selectedForm?.id === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => handleSelectForm(f)}
                    className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-red-600 bg-red-50/60 ring-1 ring-red-500 text-gray-950 font-bold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-red-600' : 'text-gray-400'}`} />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-0.5 font-normal">
                        {f.questions.length} questions • v{f.version}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                          f.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {f.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Form Editor & Questions List */}
        <div className="lg:col-span-2 space-y-6">
          {selectedForm ? (
            <>
              {/* Form Metadata Card */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-gray-950">{selectedForm.name}</h2>
                      <span className="text-xs font-mono font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {selectedForm.id}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{selectedForm.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(selectedForm)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        selectedForm.isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      {selectedForm.isActive ? 'Active in Workflow' : 'Deactivated'}
                    </button>

                    <button
                      onClick={() => handleDuplicateForm(selectedForm)}
                      className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      title="Duplicate Form"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setIsEditingFormMeta(!isEditingFormMeta)}
                      className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      title="Edit Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isEditingFormMeta ? (
                  <form onSubmit={handleSaveFormMeta} className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Form Name</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Instructions for Client</label>
                      <textarea
                        rows={3}
                        value={formInstructions}
                        onChange={(e) => setFormInstructions(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingFormMeta(false)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm"
                      >
                        Save Details
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="font-bold text-gray-900 block mb-1">Client Instructions:</span>
                    {selectedForm.instructions || 'No custom client instructions configured.'}
                  </div>
                )}
              </div>

              {/* Question List Card */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Assessment Questions ({selectedForm.questions.length})
                    </h3>
                    <p className="text-xs text-gray-500">Ordered sequence presented to the client</p>
                  </div>

                  <button
                    onClick={handleStartAddQuestion}
                    id="add-question-btn"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {/* Questions List */}
                <div className="space-y-3">
                  {selectedForm.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white transition-all space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-gray-200 text-gray-800 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-gray-950">
                              {q.text} {q.required && <span className="text-red-500">*</span>}
                            </h4>
                            {q.subtext && <p className="text-[11px] text-gray-500 mt-0.5">{q.subtext}</p>}
                          </div>
                        </div>

                        {/* Reorder and Edit buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                            title="Move Up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === selectedForm.questions.length - 1}
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                            title="Move Down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setIsNewQuestion(false);
                              setEditingQuestion({ ...q });
                            }}
                            className="p-1 text-gray-500 hover:text-red-600"
                            title="Edit Question"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 text-gray-500 hover:text-red-600"
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Question meta badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                        <span className="bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded font-mono font-semibold uppercase">
                          {q.type.replace('_', ' ')}
                        </span>
                        {q.required ? (
                          <span className="text-red-600 font-semibold">Required</span>
                        ) : (
                          <span className="text-gray-400">Optional</span>
                        )}
                        {q.options && (
                          <span className="text-gray-500">
                            {q.options.length} options ({q.options.map((o) => o.label).join(', ')})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Question Edit / Create Modal/Panel */}
              {editingQuestion && (
                <div className="bg-white rounded-2xl p-6 border-2 border-red-500/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-bold text-gray-950">
                      {isNewQuestion ? 'Create New Question' : 'Edit Question'}
                    </h3>
                    <button
                      onClick={() => setEditingQuestion(null)}
                      className="text-xs font-bold text-gray-400 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Question Text</label>
                      <input
                        type="text"
                        required
                        value={editingQuestion.text}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                        placeholder="e.g. How often did you feel a strong urge to gamble this week?"
                        className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-800 mb-1">Guidance / Helper Subtext</label>
                      <input
                        type="text"
                        value={editingQuestion.subtext || ''}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, subtext: e.target.value })}
                        placeholder="Optional reassurance or clarifying note"
                        className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-gray-800 mb-1">Response Type</label>
                        <select
                          value={editingQuestion.type}
                          onChange={(e) =>
                            setEditingQuestion({
                              ...editingQuestion,
                              type: e.target.value as QuestionType,
                            })
                          }
                          className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-semibold"
                        >
                          <option value="single_choice">Single Choice (Radio Cards)</option>
                          <option value="multiple_choice">Multiple Choice (Checkboxes)</option>
                          <option value="yes_no">Yes / No Affirmative Cards</option>
                          <option value="rating_scale">Rating Scale (Numeric 1-10)</option>
                          <option value="short_text">Short Text Answer</option>
                          <option value="long_text">Long Text / Reflection</option>
                          <option value="number">Numeric Input</option>
                          <option value="dropdown">Dropdown Selection</option>
                          <option value="date">Date Picker</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                          <input
                            type="checkbox"
                            checked={editingQuestion.required}
                            onChange={(e) =>
                              setEditingQuestion({ ...editingQuestion, required: e.target.checked })
                            }
                            className="accent-red-600 w-4 h-4 rounded"
                          />
                          <span>Required for Client</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(null)}
                        className="px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 cursor-pointer"
                      >
                        Save Question
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center text-xs text-gray-500">
              Select a form from the left panel to configure its questions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
