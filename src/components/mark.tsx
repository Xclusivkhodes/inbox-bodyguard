import Image from "next/image";

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
