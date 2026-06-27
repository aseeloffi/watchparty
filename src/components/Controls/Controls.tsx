import React, { useMemo, useState, useRef, useCallback } from "react";
import { Badge, Button, Menu, Slider } from "@mantine/core";
import { formatTimestamp, softWhite } from "../../utils/utils";
import styles from "./Controls.module.css";
import { MetadataContext } from "../../MetadataContext";
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconCheck,
  IconRepeat,
  IconBadgeCc,
  IconVolumeOff,
  IconVolume,
  IconTheater,
  IconMaximize,
  IconPlayerSkipForwardFilled,
  IconRewindBackward10,
  IconRewindForward10,
  IconPictureInPicture,
} from "@tabler/icons-react";

interface ControlsProps {
  duration: number;
  video: string;
  paused: boolean;
  muted: boolean;
  volume: number;
  subtitled: boolean;
  currentTime: number;
  disabled?: boolean;
  leaderTime?: number;
  isPauseDisabled?: boolean;
  playbackRate: number;
  roomPlaybackRate: number;
  isYouTube: boolean;
  isLiveStream: boolean;
  timeRanges: { start: number; end: number }[];
  loop: boolean;
  roomTogglePlay: () => void;
  roomSeek: (time: number) => void;
  roomSetPlaybackRate: (rate: number) => void;
  roomSetLoop: (loop: boolean) => void;
  localFullScreen: (fs: boolean) => void;
  localToggleMute: () => void;
  localSubtitleModal: () => void;
  localSeek: () => void;
  localSetVolume: (volume: number) => void;
  localSetSubtitleMode: (mode: TextTrackMode, lang?: string) => void;
  roomPlaylistPlay: (index: number) => void;
  playlist: PlaylistVideo[];
}

export const Controls = (props: ControlsProps) => {
  const [hoverState, setHoverState] = useState({ hoverTimestamp: 0, hoverPos: 0 });
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const getEnd = () => props.duration;
  const getStart = () => 0;
  const getLength = () => getEnd() - getStart();
  const getCurrent = () => props.currentTime;
  const getPercent = () => (getCurrent() - getStart()) / getLength();

  const zeroTime = useMemo(
    () => Math.floor(Date.now() / 1000) - props.duration,
    [props.video, Boolean(props.duration)],
  );

  const seekFromPct = useCallback((pct: number) => {
    const target = getLength() * Math.max(0, Math.min(1, pct));
    props.roomSeek(target);
  }, [props.roomSeek, props.duration]);

  const getPctFromEvent = (e: React.MouseEvent) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (e.clientX - rect.left) / rect.width;
  };

  const onProgressMouseDown = (e: React.MouseEvent) => {
    if (props.disabled) return;
    setIsDragging(true);
    const pct = getPctFromEvent(e);
    setDragValue(pct);
  };

  const onProgressMouseMove = (e: React.MouseEvent) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    setHoverState({ hoverTimestamp: getStart() + pct * getLength(), hoverPos: pct });
    if (isDragging && !props.disabled) {
      setDragValue(pct);
    }
  };

  const onProgressMouseUp = (e: React.MouseEvent) => {
    if (isDragging && !props.disabled) {
      seekFromPct(getPctFromEvent(e));
    }
    setIsDragging(false);
  };

  const onProgressClick = (e: React.MouseEvent) => {
    if (!props.disabled && !isDragging) {
      seekFromPct(getPctFromEvent(e));
    }
  };

  const pipAvailable = typeof document !== "undefined" && "pictureInPictureEnabled" in document;
  const enterPip = () => {
    const video = document.getElementById("leftVideo") as HTMLVideoElement;
    if (video && document.pictureInPictureEnabled) {
      video.requestPictureInPicture().catch(() => {});
    }
  };

  const displayPct = isDragging ? dragValue : getPercent();
  const behindThreshold = 10;
  const behindTime =
    !props.isLiveStream && props.leaderTime && props.leaderTime < Infinity
      ? props.leaderTime - getCurrent()
      : getEnd() - getCurrent();
  const isBehind = behindTime > behindThreshold;

  return (
    <div className={styles.controls}>

      {/* ── Play / Pause ── */}
      {props.paused ? (
        <IconPlayerPlayFilled
          className={styles.action}
          onClick={() => props.roomTogglePlay()}
          style={{ opacity: props.disabled || props.isPauseDisabled ? 0.4 : 1 }}
        />
      ) : (
        <IconPlayerPauseFilled
          className={styles.action}
          onClick={() => props.roomTogglePlay()}
          style={{ opacity: props.disabled || props.isPauseDisabled ? 0.4 : 1 }}
        />
      )}

      {/* ── Skip ± 10s ── */}
      <IconRewindBackward10
        className={styles.action}
        title="رجوع ١٠ ثواني"
        style={{ opacity: props.disabled ? 0.4 : 1 }}
        onClick={() => {
          if (!props.disabled) props.roomSeek(getCurrent() - 10);
        }}
      />
      <IconRewindForward10
        className={styles.action}
        title="تقديم ١٠ ثواني"
        style={{ opacity: props.disabled ? 0.4 : 1 }}
        onClick={() => {
          if (!props.disabled) props.roomSeek(getCurrent() + 10);
        }}
      />

      {/* ── Skip to next in playlist ── */}
      {props.playlist.length > 0 && (
        <IconPlayerSkipForwardFilled
          title="الفيديو التالي"
          className={styles.action}
          onClick={() => props.roomPlaylistPlay(0)}
        />
      )}

      {/* ── Volume ── */}
      {props.muted ? (
        <IconVolumeOff className={styles.action} onClick={props.localToggleMute} />
      ) : (
        <IconVolume className={styles.action} onClick={props.localToggleMute} />
      )}
      <div style={{ width: "80px" }}>
        <Slider
          defaultValue={props.volume}
          disabled={props.muted}
          min={0}
          max={1}
          step={0.01}
          size="xs"
          onChangeEnd={(value: number) => props.localSetVolume(value)}
        />
      </div>

      {/* ── Time ── */}
      <div className={styles.text}>
        {formatTimestamp(getCurrent(), props.isLiveStream ? zeroTime : undefined)}
      </div>

      {/* ── Progress bar ── */}
      <div
        ref={progressRef}
        className={styles.progressBar}
        onMouseDown={onProgressMouseDown}
        onMouseMove={(e) => { setShowTimestamp(true); onProgressMouseMove(e); }}
        onMouseUp={onProgressMouseUp}
        onMouseLeave={() => { setShowTimestamp(false); setIsDragging(false); }}
        onClick={onProgressClick}
      >
        {/* Buffered ranges */}
        {props.timeRanges.map(({ start, end }) => (
          <div
            key={start}
            className={styles.buffered}
            style={{
              left: (start / getLength()) * 100 + "%",
              width: ((end - start) / getLength()) * 100 + "%",
            }}
          />
        ))}

        {/* Played */}
        <div
          className={styles.played}
          style={{ width: Math.min(displayPct * 100, 100) + "%" }}
        />

        {/* Thumb */}
        {getLength() < Infinity && (
          <div
            className={styles.thumb}
            style={{ left: `calc(${Math.min(displayPct * 100, 100)}% - 6px)` }}
          />
        )}

        {/* Hover timestamp */}
        {getLength() < Infinity && showTimestamp && (
          <Badge
            className={styles.hoverBadge}
            style={{ left: `${hoverState.hoverPos * 100}%` }}
          >
            {formatTimestamp(hoverState.hoverTimestamp, props.isLiveStream ? zeroTime : undefined)}
          </Badge>
        )}
      </div>

      {/* ── Duration ── */}
      <div className={styles.text}>{formatTimestamp(getEnd())}</div>

      {/* ── LIVE badge ── */}
      {props.isLiveStream && (
        <Badge size="xs" color="red">LIVE</Badge>
      )}

      {/* ── Sync ── */}
      {isBehind && (
        <Button
          size="compact-xs"
          color="blue"
          title={`متأخر ${Math.floor(behindTime)} ث`}
          onClick={() => {
            if (props.isLiveStream) {
              props.roomSeek(props.duration);
            } else {
              props.localSeek();
            }
          }}
        >
          sync {Math.floor(behindTime)}s
        </Button>
      )}

      {/* ── Spacer ── */}
      <div style={{ flexGrow: 1 }} />

      {/* ── Speed ── */}
      <Menu disabled={props.disabled}>
        <Menu.Target>
          <div
            className={`${styles.text} ${styles.action}`}
            style={{
              backgroundColor: "rgba(100,100,100,0.6)",
              fontSize: 10,
              borderRadius: "4px",
              padding: "2px 4px",
            }}
          >
            {props.playbackRate?.toFixed(2)}x
          </div>
        </Menu.Target>
        <Menu.Dropdown>
          {[
            { key: "Auto", text: "Auto", value: 0 },
            { key: "0.25", text: "0.25x", value: 0.25 },
            { key: "0.5", text: "0.5x", value: 0.5 },
            { key: "1", text: "1x", value: 1 },
            { key: "1.5", text: "1.5x", value: 1.5 },
            { key: "2", text: "2x", value: 2 },
            { key: "3", text: "3x", value: 3 },
          ].map((item) => (
            <Menu.Item
              key={item.key}
              onClick={() => props.roomSetPlaybackRate(item.value)}
              rightSection={props.roomPlaybackRate === item.value ? <IconCheck /> : null}
            >
              {item.text}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      {/* ── Loop ── */}
      <IconRepeat
        className={styles.action}
        title="تكرار"
        color={props.loop ? "green" : softWhite}
        onClick={() => { if (!props.disabled) props.roomSetLoop(!props.loop); }}
      />

      {/* ── Subtitles ── */}
      {props.isYouTube ? (
        <Menu>
          <Menu.Target>
            <IconBadgeCc className={styles.action} />
          </Menu.Target>
          <Menu.Dropdown>
            {[
              { key: "hidden", text: "إيقاف", value: "hidden" },
              { key: "en", text: "English", value: "showing" },
              { key: "es", text: "Spanish", value: "showing" },
            ].map((item) => (
              <Menu.Item
                key={item.key}
                onClick={() => props.localSetSubtitleMode(item.value as TextTrackMode, item.key)}
              >
                {item.text}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      ) : (
        <IconBadgeCc
          className={styles.action}
          title="ترجمة"
          color={props.subtitled ? "green" : softWhite}
          onClick={props.localSubtitleModal}
        />
      )}

      {/* ── PiP ── */}
      {pipAvailable && !props.isYouTube && (
        <IconPictureInPicture
          className={styles.action}
          title="Picture in Picture"
          onClick={enterPip}
        />
      )}

      {/* ── Theater / Fullscreen ── */}
      <IconTheater
        className={styles.action}
        title="وضع المسرح"
        onClick={() => props.localFullScreen(false)}
      />
      <IconMaximize
        className={styles.action}
        title="شاشة كاملة"
        onClick={() => props.localFullScreen(true)}
      />
    </div>
  );
};
