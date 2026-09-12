import {
  cloneElement,
  createContext,
  useContext,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  collectConstraintMessages,
  constraintMessageId,
  focusControl,
  preventNativeInvalid,
} from "./formValidation";

type WorkieFormContextValue = {
  messages: Record<string, string>;
};

const WorkieFormContext = createContext<WorkieFormContextValue>({
  messages: {},
});

export function useConstraintField(
  fieldId: string,
  extraMessage?: string,
): {
  message: string | undefined;
  fieldProps: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  };
} {
  const { messages } = useContext(WorkieFormContext);
  const message = messages[fieldId] ?? extraMessage;
  return {
    message,
    fieldProps: {
      id: fieldId,
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? constraintMessageId(fieldId) : undefined,
    },
  };
}

export function ConstraintMessage({
  fieldId,
  extraMessage,
}: {
  fieldId: string;
  extraMessage?: string;
}): ReactElement | null {
  const { message } = useConstraintField(fieldId, extraMessage);
  if (!message) {
    return null;
  }
  return (
    <p
      id={constraintMessageId(fieldId)}
      className="type-body-s"
      data-field-message="true"
    >
      {message}
    </p>
  );
}

export function ConstraintField({
  fieldId,
  extraMessage,
  children,
}: {
  fieldId: string;
  extraMessage?: string;
  children: ReactElement;
}): ReactElement {
  const { fieldProps } = useConstraintField(fieldId, extraMessage);
  return (
    <>
      {cloneElement(children, fieldProps)}
      <ConstraintMessage fieldId={fieldId} extraMessage={extraMessage} />
    </>
  );
}

type WorkieFormProps = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "onSubmit" | "noValidate"
> & {
  children: ReactNode;
  onValidSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function WorkieForm({
  children,
  onValidSubmit,
  onInvalid,
  ...rest
}: WorkieFormProps): ReactElement {
  const [messages, setMessages] = useState<Record<string, string>>({});

  function handleInvalid(event: FormEvent<HTMLFormElement>): void {
    preventNativeInvalid(event);
    onInvalid?.(event);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const collected = collectConstraintMessages(event.currentTarget);
    setMessages(collected.messages);
    if (collected.firstId) {
      focusControl(event.currentTarget, collected.firstId);
      return;
    }
    onValidSubmit(event);
  }

  return (
    <WorkieFormContext.Provider value={{ messages }}>
      <form
        {...rest}
        noValidate
        onInvalid={handleInvalid}
        onSubmit={handleSubmit}
      >
        {children}
      </form>
    </WorkieFormContext.Provider>
  );
}
