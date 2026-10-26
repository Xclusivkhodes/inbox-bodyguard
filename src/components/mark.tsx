import Image from "next/image";

export function Lockup({ height = 22 }: { height?: number }) {
  const width = Math.round(height * (347 / 50));
  return (
    <>
      <Image
        src="/logo/lockup-light.svg"
        width={width}
        height={height}
        alt="Inbox Bodyguard"
        unoptimized
        className="dark:hidden"
        style={{ width, height }}
      />
      <Image
        src="/logo/lockup-dark.svg"
        width={width}
        height={height}
        alt=""
        unoptimized
        className="hidden dark:block"
        style={{ width, height }}
      />
    </>
  );
}

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <>
      <Image
        src="/logo/mark-light.svg"
        width={size}
        height={size}
        alt=""
        unoptimized
        className="dark:hidden"
        style={{ width: size, height: size }}
      />
      <Image
        src="/logo/mark-dark.svg"
        width={size}
        height={size}
        alt=""
        unoptimized
        className="hidden dark:block"
        style={{ width: size, height: size }}
      />
    </>
  );
}
