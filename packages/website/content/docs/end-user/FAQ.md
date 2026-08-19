# Frequently Asked Questions (FAQ)

### What are the supported platforms?

MarkWeave is a desktop application and available for:

- Linux x64 (tested on Debian and Red Hat based distros)
- macOS 11 (Big Sur) or later, x64 and arm64 (Apple Silicon)
- Windows 10 or 11, x64 and arm64

### Is MarkWeave open-source and free?

Yes, MarkWeave is licensed under the [MIT](https://github.com/markweave/markweave/blob/develop/LICENSE) license and completely free for everyone. The source-code is available on [GitHub](https://github.com/markweave/markweave).

### Can I use MarkWeave as note management/taking app?

MarkWeave is a pure markdown editor without feature such as knowledge management and tags but yes, you can do this via the integrated filesystem explorer and task lists.

### Where can I find documentation?

The full documentation is available on the MarkWeave website:

- [End-user documentation](../README.md)

- [Developer documentation](../dev/README.md)

### Can I run a portable version of MarkWeave?

Yes, please see [here](PORTABLE.md) for further information.

### How can I report bugs and problems

You can report bugs and problems via our [GitHub issue tracker](https://github.com/markweave/markweave/issues). Please provide a detailed description of the problem to better solve the issue.

### I cannot launch MarkWeave on Linux (SUID sandbox)

> _The SUID sandbox helper binary was found, but is not configured correctly._

Normally, you should never get this error but if you disabled user namespaces, this error message may appears in the command output when launching MarkWeave. To solve the issue, that Chromium cannot start the sandbox (process), you can choose one of the following steps:

- Enable Linux kernel user namespaces to use the preferred sandbox: `sudo sysctl kernel.unprivileged_userns_clone=1`.
- Set correct SUID sandbox helper binary permissions: `sudo chown root <path_to_marktext_dir>/chrome-sandbox && sudo chmod 4755 <path_to_marktext_dir>/chrome-sandbox`. This is preferred if you don't want to enable user namespaces.
- Launch MarkWeave with `--no-sandbox` argument.
