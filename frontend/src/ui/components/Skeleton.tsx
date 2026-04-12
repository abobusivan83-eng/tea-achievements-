import clsx from "clsx";

export function Skeleton(props: { className?: string }) {
  return <div className={clsx("skeleton", props.className)} />;
}

