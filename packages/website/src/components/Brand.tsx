import Link from 'next/link'

export default function Brand() {
  return (
    <Link className="brand" href="/">
      <img className="mark" src="/assets/logo.png" alt="MarkWeave logo" width={28} height={28} />
      MarkWeave
    </Link>
  )
}
