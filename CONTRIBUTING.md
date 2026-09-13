# Contributing

Pull requests enroll reviewed releases; they do not upload package source code
to this repository. Add exactly one safe registration record unless the market
maintainers asked for a batch change. Do not edit `index.v2.json` manually.

The registered repository's latest stable GitHub Release must contain the
packer-created entry JSON and ZIP. Their identity, publisher, byte count and
SHA-256 must agree. Release failures are reported as a failed atomic batch, so
an unrelated bad enrollment cannot silently disappear from the market.
