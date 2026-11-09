# Netproxy

Network proxy made for CRI4.0 tests

Requires golang (at least v1.21 I think), it builds with `mage` (see [their website](https://magefile.org))

## Build

```sh
# Compile
mage build

# Compile and run
mage run

# Cleanup
mage clean
```

## Usage

The program expects a `config.json` file in its current working directory.
There is an example at the root of this repo


