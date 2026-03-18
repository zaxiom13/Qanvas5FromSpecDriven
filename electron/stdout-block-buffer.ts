export class StdoutBlockBuffer {
  private lines: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly emit: (text: string) => void,
    private readonly debounceMs = 12
  ) {}

  get hasPending() {
    return this.lines.length > 0;
  }

  append(line: string) {
    this.lines.push(line);
    this.scheduleFlush();
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.lines.length) {
      return;
    }
    this.emit(this.lines.join('\n'));
    this.lines = [];
  }

  dispose() {
    this.flush();
  }

  private scheduleFlush() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.debounceMs);
  }
}
