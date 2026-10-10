import { SimulateForm } from "@/components/simulate-form";

export default function SimulatePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulate a call</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Enter what a caller told the receptionist and run it through the same qualification rules that live calls use. Every call created here is stored and labelled as a{" "}
          <strong>simulated demo call</strong>.
        </p>
      </div>
      <SimulateForm />
    </div>
  );
}
