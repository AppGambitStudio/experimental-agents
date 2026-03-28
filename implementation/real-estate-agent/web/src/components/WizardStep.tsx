interface WizardStepProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function WizardStep({ title, subtitle, children }: WizardStepProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}
