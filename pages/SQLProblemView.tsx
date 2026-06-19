import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { PGlite } from "@electric-sql/pglite";
import { SQLProblem } from "../types";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { useAuth } from "../App";
import {
  ChevronLeft,
  Play,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Plus,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { FocusTimer } from "../components/FocusTimer";

interface RunResult {
  fields: string[];
  rows: any[];
}

interface TestCaseResult {
  passed: boolean;
  error: string | null;
  userResult: RunResult | null;
  expectedResult: RunResult | null;
  timeMs: number;
  isHidden?: boolean;
}

export default function SQLProblemView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { theme } = useAuth();

  const [problem, setProblem] = useState<SQLProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryCode, setQueryCode] = useState("");
  const [dbLoading, setDbLoading] = useState(false);

  // Multiple user editable test cases
  const [testCasesSql, setTestCasesSql] = useState<string[]>([]);
  const [activeTestCaseIdx, setActiveTestCaseIdx] = useState(0);

  const [runResults, setRunResults] = useState<TestCaseResult[]>([]);
  const [verdict, setVerdict] = useState<
    "Accepted" | "Wrong Answer" | "Error" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runType, setRunType] = useState<"run" | "submit" | null>(null);
  const [consoleTab, setConsoleTab] = useState<"testcase" | "output">(
    "testcase",
  );
  const [isSolved, setIsSolved] = useState(false);
  const [runningProgress, setRunningProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [inputTables, setInputTables] = useState<
    { tableName: string; fields: string[]; rows: any[] }[] | null
  >(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInputTables = async () => {
      if (testCasesSql.length === 0 || consoleTab !== "testcase") return;
      const setupSql = testCasesSql[activeTestCaseIdx];
      if (!setupSql) {
        setInputTables([]);
        setSchemaError(null);
        return;
      }
      try {
        setSchemaError(null);
        const pg = new PGlite();
        await pg.exec(setupSql);
        const tablesRes = await pg.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
        );
        const tables: { tableName: string; fields: string[]; rows: any[] }[] =
          [];
        for (const row of tablesRes.rows) {
          const tableName = (row as any).table_name;
          const res = await pg.query(`SELECT * FROM "${tableName}" LIMIT 15`);
          tables.push({
            tableName,
            fields: res.fields.map((f) => f.name),
            rows: res.rows,
          });
        }
        setInputTables(tables);
        pg.close();
      } catch (e: any) {
        console.error("Failed to parse input tables", e);
        setInputTables([]);
        setSchemaError(e.message || String(e));
      }
    };
    fetchInputTables();
  }, [activeTestCaseIdx, testCasesSql, consoleTab]);

  useEffect(() => {
    if (!problem || !auth.currentUser) return;
    const fetchSolved = async () => {
      const q = query(
        collection(db, "sqlSubmissions"),
        where("userId", "==", auth.currentUser!.uid),
        where("problemId", "==", problem.id),
        where("status", "==", "Accepted"),
      );
      const snap = await getDocs(q);
      if (!snap.empty) setIsSolved(true);
    };
    fetchSolved();
  }, [problem, auth.currentUser]);

  useEffect(() => {
    const fetchProblem = async () => {
      if (!slug) return;
      try {
        const q = query(
          collection(db, "sqlProblems"),
          where("slug", "==", slug),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = {
            id: snap.docs[0].id,
            ...snap.docs[0].data(),
          } as SQLProblem;
          setProblem(data);
          const draft = localStorage.getItem(`sql_draft_${slug}`);
          setQueryCode(draft ? draft : data.starterQuery || "");
          setTestCasesSql(
            data.sampleTestCases && data.sampleTestCases.length > 0
              ? data.sampleTestCases
              : [data.visibleSetupSql || ""],
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProblem();
  }, [slug]);

  useEffect(() => {
    if (
      slug &&
      queryCode !== undefined &&
      problem &&
      queryCode !== problem.starterQuery
    ) {
      localStorage.setItem(`sql_draft_${slug}`, queryCode);
    }
  }, [slug, queryCode, problem]);

  useEffect(() => {
    const init = async () => {
      setDbLoading(true);
      try {
        const testPg = new PGlite();
        await testPg.query("SELECT 1");
        testPg.close();
      } catch (e) {}
      setDbLoading(false);
    };
    init();
  }, []);

  const compareRows = (
    actual: any[],
    expected: any[],
    expectedFields: string[],
    actualFields: string[],
  ) => {
    if (actual.length !== expected.length) return false;
    if (actualFields.length !== expectedFields.length) return false;

    for (let i = 0; i < expectedFields.length; i++) {
      if (expectedFields[i] !== actualFields[i]) return false;
    }

    for (let i = 0; i < actual.length; i++) {
      const r1 = actual[i] as any;
      const r2 = expected[i] as any;
      for (const f of expectedFields) {
        if (String(r1[f]) !== String(r2[f])) return false;
      }
    }
    return true;
  };

  const countVerdict = (
    results: TestCaseResult[],
  ): "Accepted" | "Wrong Answer" | "Error" => {
    if (results.some((r) => r.error)) return "Error";
    if (results.some((r) => !r.passed)) return "Wrong Answer";
    return "Accepted";
  };

  const [leftPanelTab, setLeftPanelTab] = useState<
    "description" | "submissions" | "result"
  >("description");
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!problem || !auth.currentUser) return;
      try {
        const q = query(
          collection(db, "sqlSubmissions"),
          where("userId", "==", auth.currentUser.uid),
          where("problemId", "==", problem.id),
        );
        const snap = await getDocs(q);
        let subs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        subs.sort((a: any, b: any) => b.timestamp - a.timestamp);
        setSubmissionsList(subs);
      } catch (e) {}
    };
    fetchSubmissions();
  }, [problem, auth.currentUser, leftPanelTab]);

  const runQuery = async (isSubmit = false) => {
    if (!problem) return;
    setIsSubmitting(isSubmit);
    setIsRunning(true);
    setRunType(isSubmit ? "submit" : "run");
    setConsoleTab("output");
    setVerdict(null);
    if (isSubmit) setLeftPanelTab("result");

    try {
      let casesToRun = [...testCasesSql];
      let hiddenCount = 0;
      // If it's a real submit, append the hidden test case to evaluate it behind the scenes
      if (isSubmit) {
        if (problem.hiddenTestCases && problem.hiddenTestCases.length > 0) {
          casesToRun = [...casesToRun, ...problem.hiddenTestCases];
          hiddenCount = problem.hiddenTestCases.length;
        } else if (problem.hiddenSetupSql) {
          casesToRun.push(problem.hiddenSetupSql);
          hiddenCount = 1;
        }
      }

      let newResults: TestCaseResult[] = new Array(casesToRun.length);

      const runTestCase = async (i: number, isHiddenCase: boolean) => {
        const setupSql = casesToRun[i];
        let timeMs = 0;
        let expectedRes: RunResult | null = null;
        let userRes: RunResult | null = null;
        let errorMsg: string | null = null;
        let passed = false;

        try {
          // 1. Evaluate Expected Result
          if (problem.solutionQuery) {
            const pgExp = new PGlite();
            if (setupSql) await pgExp.exec(setupSql);
            const rExp = await pgExp.query(problem.solutionQuery);
            if (problem.validationQuery) {
              const vExp = await pgExp.query(problem.validationQuery);
              expectedRes = {
                fields: vExp.fields.map((f) => f.name),
                rows: vExp.rows,
              };
            } else {
              expectedRes = {
                fields: rExp.fields.map((f) => f.name),
                rows: rExp.rows,
              };
            }
            pgExp.close();
          }

          // 2. Evaluate User Result
          const pgUser = new PGlite();
          if (setupSql) await pgUser.exec(setupSql);
          const start = performance.now();
          const rUser = await pgUser.query(queryCode);
          if (problem.validationQuery) {
            const vUser = await pgUser.query(problem.validationQuery);
            userRes = {
              fields: vUser.fields.map((f) => f.name),
              rows: vUser.rows,
            };
          } else {
            userRes = {
              fields: rUser.fields.map((f) => f.name),
              rows: rUser.rows,
            };
          }
          const end = performance.now();
          timeMs = Math.round(end - start);
          pgUser.close();

          // 3. Compare
          if (!expectedRes && problem.expectedOutput && i === 0) {
            // Fallback for first case to static expected format if solutionQuery not present
            let expectedRows = problem.expectedOutput;
            let expectedFields =
              expectedRows.length > 0 ? Object.keys(expectedRows[0]) : [];
            expectedRes = { fields: expectedFields, rows: expectedRows };
          }

          if (expectedRes && userRes) {
            passed = compareRows(
              userRes.rows,
              expectedRes.rows,
              expectedRes.fields,
              userRes.fields,
            );
          } else if (!expectedRes && userRes) {
            if (i > 0) {
              errorMsg =
                "Cannot evaluate dynamic testcase automatically without a reference 'solutionQuery' assigned to this problem.";
              passed = false;
            } else {
              passed = true;
            }
          }
        } catch (e: any) {
          let msg = e.message || String(e);
          if (e.position)
            msg += `\nError near character position ${e.position}`;
          if (e.detail) msg += `\nDetail: ${e.detail}`;
          if (e.hint) msg += `\nHint: ${e.hint}`;
          errorMsg = msg;
          passed = false;
        }

        if (!isHiddenCase) {
          return {
            passed,
            error: errorMsg,
            userResult: userRes,
            expectedResult: expectedRes,
            timeMs,
          };
        } else {
          return {
            passed,
            error: passed ? null : "A hidden testcase failed.",
            userResult: null,
            expectedResult: null,
            timeMs,
            isHidden: true,
          };
        }
      };

      const concurrency = 4;
      const chunks = [];
      for (let i = 0; i < casesToRun.length; i += concurrency) {
        chunks.push(
          casesToRun.slice(i, i + concurrency).map((_, idx) => i + idx),
        );
      }

      let completed = 0;
      let shouldStop = false;
      for (const chunk of chunks) {
        if (shouldStop) {
          for (const i of chunk) {
            newResults[i] = {
              passed: false,
              error: "Skipped due to previous failure",
              userResult: null,
              expectedResult: null,
              timeMs: 0,
              isHidden: true,
            };
          }
          continue;
        }
        const promises = chunk.map(async (i) => {
          const isHiddenCase =
            isSubmit && hiddenCount > 0 && i >= casesToRun.length - hiddenCount;
          const res = await runTestCase(i, isHiddenCase);
          return { i, res };
        });
        const chunkResults = await Promise.all(promises);
        for (const cr of chunkResults) {
          newResults[cr.i] = cr.res;
          if (!cr.res.passed && isSubmit) {
            shouldStop = true;
          }
        }
        completed += chunk.length;
        setRunningProgress({
          current: Math.min(completed, casesToRun.length),
          total: casesToRun.length,
        });
      }

      setRunResults(newResults);

      let allPassed = newResults.every((r) => r.passed);
      let finalVerdict = countVerdict(newResults);
      if (!allPassed)
        finalVerdict = finalVerdict === "Error" ? "Error" : "Wrong Answer";
      setVerdict(finalVerdict);

      if (isSubmit && auth.currentUser) {
        await addDoc(collection(db, "sqlSubmissions"), {
          userId: auth.currentUser.uid,
          problemId: problem.id,
          query: queryCode,
          status: finalVerdict,
          executionTimeMs: newResults.reduce((acc, r) => acc + r.timeMs, 0),
          timestamp: Date.now(),
        });
        if (finalVerdict === "Accepted") {
          setIsSolved(true);
          import("canvas-confetti").then((confetti) => confetti.default());
        }
      }
    } finally {
      setIsSubmitting(false);
      setIsRunning(false);
      setRunningProgress(null);
    }
  };

  const runQueryRef = useRef(runQuery);
  useEffect(() => {
    runQueryRef.current = runQuery;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + '
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault();
        runQueryRef.current(false);
      }
      // Cmd/Ctrl + Enter
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runQueryRef.current(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) return <div className="p-8">Loading problem...</div>;
  if (!problem) return <div className="p-8">Problem not found.</div>;

  const getDifficultyClass = () => {
    if (problem.difficulty === "Easy") return "text-emerald-500";
    if (problem.difficulty === "Medium") return "text-amber-500";
    return "text-red-500";
  };

  const updateTestCase = (idx: number, val: string) => {
    const newArr = [...testCasesSql];
    newArr[idx] = val;
    setTestCasesSql(newArr);
  };

  const activeResult = runResults[activeTestCaseIdx];

  return (
    <div className="h-full flex flex-col font-sans bg-[#F0F0F0] dark:bg-[#121212]">
      <div className="flex items-center justify-between px-4 h-12 bg-white dark:bg-[#1e1e1e] border-b border-gray-200 dark:border-[#333] shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/sql")}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="font-semibold text-sm text-slate-800 dark:text-gray-200 tracking-tight">
            {problem.title}
          </h1>
        </div>
        <div className="flex gap-3 items-center">
          <FocusTimer inline={true} />
          {runningProgress && (
            <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md mr-1">
              <RefreshCw className="animate-spin" size={14} />
              <span>
                {runningProgress.current}/{runningProgress.total}
              </span>
            </div>
          )}
          <button
            onClick={() => runQuery(false)}
            disabled={dbLoading || isRunning}
            title="Run Code (Cmd/Ctrl + ')"
            className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#2d2d2d] dark:hover:bg-[#3d3d3d] text-slate-700 dark:text-slate-300 rounded-md text-sm font-medium transition-colors disabled:opacity-50 min-w-[90px] justify-center"
          >
            {dbLoading || (isRunning && !isSubmitting) ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <Play size={14} />
            )}
            {isRunning && !isSubmitting ? "Running..." : "Run"}
          </button>
          <button
            onClick={() => runQuery(true)}
            disabled={dbLoading || isRunning}
            title="Submit Code (Cmd/Ctrl + Enter)"
            className="flex items-center gap-2 px-4 py-1.5 bg-[#000000] hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 shadow-sm min-w-[110px] justify-center"
          >
            {isRunning && isSubmitting ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <Send size={14} />
            )}
            {isRunning && isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2.5">
        <PanelGroup orientation="horizontal" className="h-full">
          {/* Left Panel: Description / Submissions / Result */}
          <Panel
            defaultSize={40}
            minSize={25}
            className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-[#333] flex flex-col shadow-sm"
          >
            <div className="flex border-b border-gray-100 dark:border-[#333] px-2 pt-2 shrink-0 items-center justify-between">
              <div className="flex">
                <button
                  onClick={() => setLeftPanelTab("description")}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${leftPanelTab === "description" ? "border-primary-500 text-slate-800 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-gray-300"}`}
                >
                  Description
                </button>
                <button
                  onClick={() => setLeftPanelTab("submissions")}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${leftPanelTab === "submissions" ? "border-primary-500 text-slate-800 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-gray-300"}`}
                >
                  Submissions
                </button>
                {leftPanelTab === "result" && (
                  <button className="px-4 py-2 font-medium text-sm border-b-2 transition-colors border-primary-500 text-emerald-600 dark:text-emerald-400">
                    Result
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {leftPanelTab === "description" && (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide ${getDifficultyClass()} bg-slate-50 dark:bg-[#2d2d2d]`}
                    >
                      {problem.difficulty}
                    </span>
                    {isSolved && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
                        <CheckCircle2 size={14} />
                        Solved
                      </span>
                    )}
                    {(problem.tags || []).map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 rounded-md text-xs font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-gray-400 prose-headings:text-slate-800 dark:prose-headings:text-gray-200 prose-code:font-mono prose-code:text-slate-800 dark:prose-code:text-gray-300 prose-code:bg-slate-100 dark:prose-code:bg-[#2d2d2d] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-50 dark:prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-[#333]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {problem.description || ""}
                    </ReactMarkdown>
                  </div>
                </>
              )}

              {leftPanelTab === "submissions" && (
                <div className="space-y-4">
                  {submissionsList.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      No submissions yet.
                    </div>
                  ) : (
                    submissionsList.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-4 rounded-xl border border-gray-100 dark:border-[#333] bg-slate-50 dark:bg-[#1a1a1a]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`font-semibold text-sm ${sub.status === "Accepted" ? "text-emerald-600" : "text-red-500"}`}
                          >
                            {sub.status}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(sub.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">
                          Execution Time: {sub.executionTimeMs}ms
                        </div>
                        <pre className="text-xs p-3 rounded-lg overflow-x-auto bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222]">
                          <code className="font-mono text-slate-700 dark:text-gray-300">
                            {sub.query}
                          </code>
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              )}

              {leftPanelTab === "result" && (
                <div className="flex flex-col h-full overflow-y-auto">
                  {isRunning ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                      <RefreshCw
                        className="animate-spin text-blue-500 mb-4"
                        size={32}
                      />
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
                        Evaluating Submission
                      </h2>
                      <p className="text-sm">
                        Running test case{" "}
                        {runningProgress ? runningProgress.current : 0} of{" "}
                        {runningProgress ? runningProgress.total : "..."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {verdict === "Accepted" ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800/30 mb-6">
                          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800/50 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={32} />
                          </div>
                          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                            Accepted!
                          </h2>
                          <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 text-center">
                            Your query passed all test cases.
                          </p>
                          <p className="text-xs font-medium text-emerald-700/60 dark:text-emerald-400/60 mt-3 text-center">
                            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30 mb-6">
                          <div className="w-16 h-16 bg-red-100 dark:bg-red-800/50 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                            <XCircle size={32} />
                          </div>
                          <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">
                            {verdict === "Error"
                              ? "Runtime Error"
                              : "Wrong Answer"}
                          </h2>
                          <p className="text-sm text-red-600/80 dark:text-red-400/80 text-center">
                            Your query failed on one or more test cases.
                          </p>
                        </div>
                      )}

                      <div className="grid gap-3">
                        {runResults
                          .map((res, i) => ({ res, idx: i + 1 }))
                          .filter(({ res }) => !res.isHidden || !res.passed)
                          .map(({ res, idx }) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border ${res.passed ? "border-gray-100 dark:border-[#333] bg-white dark:bg-[#1a1a1a]" : "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10"} flex flex-col gap-1`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {res.passed ? (
                                    <CheckCircle2
                                      size={18}
                                      className="text-emerald-500"
                                    />
                                  ) : (
                                    <XCircle
                                      size={18}
                                      className="text-red-500"
                                    />
                                  )}
                                  <span className="font-medium text-sm text-slate-700 dark:text-gray-300">
                                    Test Case {idx}{" "}
                                    {res.isHidden ? "(Hidden)" : ""}
                                  </span>
                                </div>
                                <span className="text-xs font-mono text-slate-500">
                                  {res.timeMs}ms
                                </span>
                              </div>
                              {!res.passed && res.error && (
                                <div className="text-xs font-mono text-red-600 dark:text-red-400 mt-2 pl-7 whitespace-pre-wrap">
                                  {res.error}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="w-3 flex items-center justify-center cursor-col-resize group">
            <div className="h-10 w-1 rounded-full bg-gray-300 dark:bg-[#444] group-hover:bg-[#666] transition-colors" />
          </PanelResizeHandle>

          {/* Right Panel: Editor & Console */}
          <Panel defaultSize={60} minSize={30} className="flex flex-col">
            <PanelGroup orientation="vertical" className="h-full">
              {/* Editor */}
              <Panel
                defaultSize={60}
                minSize={20}
                className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-[#333] flex flex-col shadow-sm overflow-hidden"
              >
                <div className="flex items-center h-10 px-4 border-b border-gray-100 dark:border-[#333] bg-slate-50 dark:bg-[#252526] shrink-0">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-gray-400">
                    <Database size={12} />
                    <span>{problem.databaseType || "PostgreSQL"}</span>
                  </div>
                </div>
                <div className="flex-1 p-2 bg-[#ffffff] dark:bg-[#1e1e1e]">
                  <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme={theme === 'dark' ? "vs-dark" : "light"}
                    value={queryCode}
                    onChange={(val) => setQueryCode(val || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: '"JetBrains Mono", monospace',
                      wordWrap: "on",
                      automaticLayout: true,
                      padding: { top: 12 },
                      scrollBeyondLastLine: false,
                      roundedSelection: true,
                    }}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="h-3 flex items-center justify-center cursor-row-resize group">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-[#444] group-hover:bg-[#666] transition-colors" />
              </PanelResizeHandle>

              {/* Console */}
              <Panel
                defaultSize={40}
                minSize={10}
                className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-[#333] flex flex-col shadow-sm"
              >
                <div className="flex items-center justify-between px-3 h-10 border-b border-gray-100 dark:border-[#333] bg-slate-50 dark:bg-[#252526] shrink-0">
                  <div className="flex gap-2 h-full pt-1.5">
                    <button
                      onClick={() => setConsoleTab("testcase")}
                      className={`px-4 text-[13px] font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${consoleTab === "testcase" ? "bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-gray-200 border-t border-x border-gray-200 dark:border-[#333] border-b-transparent relative top-[1px]" : "text-slate-500 hover:text-slate-700 dark:hover:text-gray-400"}`}
                    >
                      Testcases
                    </button>
                    <button
                      onClick={() => setConsoleTab("output")}
                      className={`px-4 text-[13px] font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${consoleTab === "output" ? "bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-gray-200 border-t border-x border-gray-200 dark:border-[#333] border-b-transparent relative top-[1px]" : "text-slate-500 hover:text-slate-700 dark:hover:text-gray-400"}`}
                    >
                      Test Results
                      {verdict === "Accepted" && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      )}
                      {verdict === "Wrong Answer" && (
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      )}
                      {verdict === "Error" && (
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto flex flex-col relative text-sm">
                  {/* Testcase/Result Nav Bar */}
                  <div className="flex px-4 py-2 gap-2 overflow-x-auto shrink-0 border-b border-gray-100 dark:border-[#333] bg-white dark:bg-[#1e1e1e]">
                    {(consoleTab === "output" && runResults.length > 0
                      ? runResults
                      : testCasesSql
                    )
                      .filter((_, idx) => {
                        if (consoleTab === "output")
                          return !runResults[idx]?.isHidden;
                        return true;
                      })
                      .map((_, idx) => {
                        return (
                          <div key={idx} className="flex relative group">
                            <button
                              onClick={() => setActiveTestCaseIdx(idx)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${activeTestCaseIdx === idx ? "bg-slate-100 dark:bg-[#2d2d2d] text-slate-800 dark:text-gray-200" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-[#252525]"}`}
                            >
                              Case {idx + 1}
                              {runResults[idx] &&
                                (runResults[idx].passed ? (
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                ))}
                            </button>
                          </div>
                        );
                      })}
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto">
                    {consoleTab === "testcase" && (
                      <div className="h-full flex flex-col max-w-4xl space-y-6">
                        {schemaError && (
                          <div className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 p-4 rounded-xl font-mono text-sm whitespace-pre-wrap border border-red-200 dark:border-red-900/30 leading-relaxed shadow-sm">
                            Failed to setup database tables: {schemaError}
                          </div>
                        )}
                        {inputTables ? (
                          inputTables.length > 0 ? (
                            inputTables.map((table, i) => (
                              <div key={i} className="flex flex-col">
                                <div className="text-xs font-semibold text-slate-700 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                  Table: {table.tableName}
                                </div>
                                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#333] shadow-sm bg-white dark:bg-[#121212]">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs whitespace-nowrap">
                                      <thead className="bg-slate-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
                                        <tr>
                                          {table.fields.map((f, j) => (
                                            <th
                                              key={j}
                                              className="px-4 py-2.5 font-semibold text-slate-700 dark:text-gray-300"
                                            >
                                              {f}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                                        {table.rows.map((r, rowIdx) => (
                                          <tr
                                            key={rowIdx}
                                            className="hover:bg-slate-50/80 dark:hover:bg-[#2a2a2a]"
                                          >
                                            {table.fields.map((f, colIdx) => (
                                              <td
                                                key={colIdx}
                                                className="px-4 py-2.5 text-slate-600 dark:text-gray-400 font-mono"
                                              >
                                                {String(r[f])}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                        {table.rows.length === 0 && (
                                          <tr>
                                            <td
                                              colSpan={table.fields.length || 1}
                                              className="px-4 py-4 text-center text-slate-400 italic font-mono bg-slate-50/50 dark:bg-[#1a1a1a]"
                                            >
                                              Empty
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-500 italic">
                              No tables created in this testcase.
                            </div>
                          )
                        ) : (
                          <div className="text-sm text-slate-500 italic">
                            Loading input tables...
                          </div>
                        )}

                        <div className="flex flex-col mt-4">
                          <div className="text-xs font-semibold text-slate-700 dark:text-gray-400 mb-2 uppercase tracking-wide">
                            Expected Output
                          </div>
                          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#333] shadow-sm bg-white dark:bg-[#121212]">
                            {Array.isArray(problem?.expectedOutput) &&
                            problem.expectedOutput.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                  <thead className="bg-slate-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
                                    <tr>
                                      {Object.keys(
                                        problem.expectedOutput[0],
                                      ).map((f, j) => (
                                        <th
                                          key={j}
                                          className="px-4 py-2.5 font-semibold text-slate-700 dark:text-gray-300"
                                        >
                                          {f}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                                    {problem.expectedOutput.map((r, rowIdx) => (
                                      <tr
                                        key={rowIdx}
                                        className="hover:bg-slate-50/80 dark:hover:bg-[#2a2a2a]"
                                      >
                                        {Object.keys(
                                          problem.expectedOutput[0],
                                        ).map((f, colIdx) => (
                                          <td
                                            key={colIdx}
                                            className="px-4 py-2.5 text-slate-600 dark:text-gray-400 font-mono"
                                          >
                                            {String(r[f])}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="p-4 text-[13px] font-mono text-slate-600 dark:text-gray-400 whitespace-pre-wrap">
                                {problem?.expectedOutput
                                  ? JSON.stringify(
                                      problem.expectedOutput,
                                      null,
                                      2,
                                    )
                                  : "Not available"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {consoleTab === "output" &&
                      (!activeResult ? (
                        <div className="flex flex-col items-center justify-center pt-12 text-slate-400">
                          <Play size={24} className="mb-3 opacity-50" />
                          <span className="text-sm font-medium">
                            Run Your Code To See Test Results
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-8 max-w-4xl">
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-bold text-lg flex items-center gap-2 ${activeResult.passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {activeResult.passed ? (
                                <CheckCircle2 size={20} />
                              ) : (
                                <XCircle size={20} />
                              )}
                              {activeResult.passed
                                ? "Accepted"
                                : activeResult.error
                                  ? "Runtime Error"
                                  : "Wrong Answer"}
                            </span>
                            <span className="text-xs font-mono px-2.5 py-1 box-border bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500 uppercase tracking-wide">
                              Time: {activeResult.timeMs}ms
                            </span>
                          </div>

                          {activeResult.error && (
                            <div className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 p-4 rounded-xl font-mono text-sm whitespace-pre-wrap border border-red-200 dark:border-red-900/30 leading-relaxed shadow-sm">
                              {activeResult.error}
                            </div>
                          )}

                          {activeResult.isHidden ? (
                            <div className="bg-slate-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] p-6 rounded-xl flex flex-col items-center justify-center text-slate-500 font-medium text-sm">
                              For hidden test cases, expected and actual outputs
                              are hidden.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              {activeResult.userResult && (
                                <div className="flex flex-col">
                                  <div className="text-xs font-semibold text-slate-700 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Your Output
                                  </div>
                                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex-1 bg-white dark:bg-[#121212]">
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs whitespace-nowrap">
                                        <thead className="bg-slate-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
                                          <tr>
                                            {activeResult.userResult.fields.map(
                                              (f, i) => (
                                                <th
                                                  key={"th-out-" + i}
                                                  className="px-4 py-2.5 font-semibold text-slate-700 dark:text-gray-300"
                                                >
                                                  {f}
                                                </th>
                                              ),
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                                          {activeResult.userResult.rows.map(
                                            (r, i) => (
                                              <tr
                                                key={"tr-out-" + i}
                                                className="hover:bg-slate-50/80 dark:hover:bg-[#2a2a2a]"
                                              >
                                                {activeResult.userResult!.fields.map(
                                                  (f, j) => (
                                                    <td
                                                      key={"td-out-" + j}
                                                      className="px-4 py-2.5 text-slate-600 dark:text-gray-400 font-mono"
                                                    >
                                                      {String(r[f])}
                                                    </td>
                                                  ),
                                                )}
                                              </tr>
                                            ),
                                          )}
                                          {activeResult.userResult.rows
                                            .length === 0 && (
                                            <tr>
                                              <td
                                                colSpan={
                                                  activeResult.userResult.fields
                                                    .length || 1
                                                }
                                                className="px-4 py-6 text-center text-slate-400 italic font-mono bg-slate-50/50 dark:bg-[#1a1a1a]"
                                              >
                                                Empty result set
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeResult.expectedResult &&
                                !activeResult.error && (
                                  <div className="flex flex-col">
                                    <div className="text-xs font-semibold text-slate-700 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                      Expected Output
                                    </div>
                                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex-1 bg-white dark:bg-[#121212]">
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs whitespace-nowrap">
                                          <thead className="bg-slate-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
                                            <tr>
                                              {activeResult.expectedResult.fields.map(
                                                (f, i) => (
                                                  <th
                                                    key={"th-exp-" + i}
                                                    className="px-4 py-2.5 font-semibold text-slate-700 dark:text-gray-300"
                                                  >
                                                    {f}
                                                  </th>
                                                ),
                                              )}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                                            {activeResult.expectedResult.rows.map(
                                              (r, i) => (
                                                <tr
                                                  key={"tr-exp-" + i}
                                                  className={`${!activeResult.passed ? "bg-red-50/40 dark:bg-red-900/10" : "hover:bg-slate-50/80 dark:hover:bg-[#2a2a2a]"}`}
                                                >
                                                  {activeResult.expectedResult!.fields.map(
                                                    (f, j) => (
                                                      <td
                                                        key={"td-exp-" + j}
                                                        className="px-4 py-2.5 text-slate-600 dark:text-gray-400 font-mono"
                                                      >
                                                        {String(r[f])}
                                                      </td>
                                                    ),
                                                  )}
                                                </tr>
                                              ),
                                            )}
                                            {activeResult.expectedResult.rows
                                              .length === 0 && (
                                              <tr>
                                                <td
                                                  colSpan={
                                                    activeResult.expectedResult
                                                      .fields.length || 1
                                                  }
                                                  className="px-4 py-6 text-center text-slate-400 italic font-mono bg-slate-50/50 dark:bg-[#1a1a1a]"
                                                >
                                                  Empty expected set
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
