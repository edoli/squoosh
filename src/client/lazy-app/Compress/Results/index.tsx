import { h, Component, Fragment } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import 'shared/custom-els/loading-spinner';
import { SourceImage } from '../';
import prettyBytes from './pretty-bytes';
import { Arrow, DownloadIcon } from 'client/lazy-app/icons';

interface Props {
  loading: boolean;
  source?: SourceImage;
  imageFile?: File;
  downloadUrl?: string;
  flipSide: boolean;
  typeLabel: string;
}

interface State {
  showLoadingState: boolean;
}

const loadingReactionDelay = 500;

export default class Results extends Component<Props, State> {
  state: State = {
    showLoadingState: this.props.loading,
  };

  /** The timeout ID between entering the loading state, and changing UI */
  private loadingTimeoutId: number = 0;

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.loading && !this.props.loading) {
      // Just stopped loading
      clearTimeout(this.loadingTimeoutId);
      this.setState({ showLoadingState: false });
    } else if (!prevProps.loading && this.props.loading) {
      // Just started loading
      this.loadingTimeoutId = self.setTimeout(
        () => this.setState({ showLoadingState: true }),
        loadingReactionDelay,
      );
    }
  }

  private onDownload = () => {
    // GA can’t do floats. So we round to ints. We're deliberately rounding to nearest kilobyte to
    // avoid cases where exact image sizes leak something interesting about the user.
    const before = Math.round(this.props.source!.file.size / 1024);
    const after = Math.round(this.props.imageFile!.size / 1024);
    const change = Math.round((after / before) * 1000);

    ga('send', 'event', 'compression', 'download', {
      metric1: before,
      metric2: after,
      metric3: change,
    });
  };

  private onCopy = async (e: Event) => {
    e.preventDefault();

    if (this.state.showLoadingState || !this.props.downloadUrl) return;

    try {
      const url = this.props.downloadUrl!;
      // fetch the image as a blob
      const res = await fetch(url, { credentials: 'same-origin' });
      const blob = await res.blob();

      // Modern clipboard API: write image as ClipboardItem
      if (navigator.clipboard && (window as any).ClipboardItem) {
        const clipboardItem = new (window as any).ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([clipboardItem]);

        // Optional: send GA event for copy
        ga && ga('send', 'event', 'compression', 'copy', {
          // rounded sizes like onDownload
          metric1: Math.round(this.props.source!.file.size / 1024),
          metric2: Math.round(this.props.imageFile!.size / 1024),
        });
        return;
      }

      // Fallback: try to copy image as data URL text (best-effort)
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(dataUrl);
          return;
        }
      } catch (err) {
        // fall through to final fallback
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {

      console.error('Copy to clipboard failed', err);
    }
  };

  render(
    { source, imageFile, downloadUrl, flipSide, typeLabel }: Props,
    { showLoadingState }: State,
  ) {
    const prettySize = imageFile && prettyBytes(imageFile.size);
    const isOriginal = !source || !imageFile || source.file === imageFile;
    let diff;
    let percent;

    if (source && imageFile) {
      diff = imageFile.size / source.file.size;
      const absolutePercent = Math.round(Math.abs(diff) * 100);
      percent = diff > 1 ? absolutePercent - 100 : 100 - absolutePercent;
    }

    return (
      <div
        class={
          (flipSide ? style.resultsRight : style.resultsLeft) +
          ' ' +
          (isOriginal ? style.isOriginal : '')
        }
      >
        <div class={style.expandArrow}>
          <Arrow />
        </div>
        <div class={style.bubble}>
          <div class={style.bubbleInner}>
            <div class={style.sizeInfo}>
              <div class={style.fileSize}>
                {prettySize ? (
                  <Fragment>
                    {prettySize.value}{' '}
                    <span class={style.unit}>{prettySize.unit}</span>
                    <span class={style.typeLabel}> {typeLabel}</span>
                  </Fragment>
                ) : (
                  '…'
                )}
              </div>
            </div>
            <div class={style.percentInfo}>
              <svg
                viewBox="0 0 1 2"
                class={style.bigArrow}
                preserveAspectRatio="none"
              >
                <path d="M1 0v2L0 1z" />
              </svg>
              <div class={style.percentOutput}>
                {diff && diff !== 1 && (
                  <span class={style.sizeDirection}>
                    {diff < 1 ? '↓' : '↑'}
                  </span>
                )}
                <span class={style.sizeValue}>{percent || 0}</span>
                <span class={style.percentChar}>%</span>
              </div>
            </div>
          </div>
        </div>
        <a
          class={showLoadingState ? style.downloadDisable : style.download}
          href={downloadUrl}
          download={imageFile ? imageFile.name : ''}
          title="Download"
          onClick={this.onDownload}
        >
          <svg class={style.downloadBlobs} viewBox="0 0 89.6 86.9">
            <title>Download</title>
            <path d="M27.3 72c-8-4-15.6-12.3-16.9-21-1.2-8.7 4-17.8 10.5-26s14.4-15.6 24-16 21.2 6 28.6 16.5c7.4 10.5 10.8 25 6.6 34S64.1 71.8 54 73.6c-10.2 2-18.7 2.3-26.7-1.6z" />
            <path d="M19.8 24.8c4.3-7.8 13-15 21.8-15.7 8.7-.8 17.5 4.8 25.4 11.8 7.8 6.9 14.8 15.2 14.7 24.9s-7.1 20.7-18 27.6c-10.8 6.8-25.5 9.5-34.2 4.8S18.1 61.6 16.7 51.4c-1.3-10.3-1.3-18.8 3-26.6z" />
          </svg>
          <div class={style.downloadIcon}>
            <DownloadIcon />
          </div>
          {showLoadingState && <loading-spinner />}
        </a>
        <button
          class={showLoadingState ? style.downloadDisable : style.download}
          title="Copy"
          onClick={this.onCopy}
          disabled={showLoadingState}
        >
          {/* 간단한 copy 아이콘 인라인 SVG */}
          <svg class={style.downloadBlobs} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <title>Copy</title>
            <path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zM20 5H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 14H8V7h12v12z" />
          </svg>
        </button>
      </div>
    );
  }
}
