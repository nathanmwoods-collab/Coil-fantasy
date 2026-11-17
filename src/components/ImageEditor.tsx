import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, ScrollView, View } from 'react-native';

import { type } from '../theme/type';
import { c, T } from './ui';

export const TEAM_EMOJI = ['🐍', '🌮', '🏈', '🙏', '🪄', '🎷', '🦵', '🎉', '👻', '🧢', '🔥', '🦅', '🐻', '🦁', '🐺', '🦈', '🐉', '⚡️', '💀', '👑', '🍕', '🍺', '🎯', '🚀', '🌵', '🧀', '🥩', '🐐', '🦬', '🏴‍☠️'];

const FRAME = 260;
const OUT = 512;

type Look = { emoji?: string; imageUri?: string | undefined };

/**
 * Change a team or league picture: pick one of the built-in icons, or upload a
 * photo and crop it (drag to move, zoom in or out). The result is a square
 * image, resized so it stays small.
 */
export function ImageEditor({ visible, title, current, emojiChoices = TEAM_EMOJI, defaultLabel, onClose, onDone }: {
  visible: boolean;
  title: string;
  current: Look;
  emojiChoices?: string[];
  /** Shown as the first choice when the default is not an emoji (the Coil mark for leagues). */
  defaultLabel?: string;
  onClose: () => void;
  onDone: (look: Look) => void;
}) {
  const [src, setSrc] = useState<{ uri: string; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!visible) setSrc(null);
  }, [visible]);

  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    const a = res.canceled ? null : res.assets?.[0];
    if (!a) return;
    if (a.width && a.height) setSrc({ uri: a.uri, w: a.width, h: a.height });
    else Image.getSize(a.uri, (w, h) => setSrc({ uri: a.uri, w, h }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => null} style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          {src ? (
            <Cropper src={src} onCancel={() => setSrc(null)} onSave={(uri) => onDone({ imageUri: uri })} />
          ) : (
            <>
              <T style={[type.display24, { marginBottom: 12 }]}>{title}</T>
              <Pressable onPress={upload} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.primary, marginBottom: 8 }}>
                <T style={{ fontSize: 20 }}>📷</T>
                <View style={{ flex: 1 }}>
                  <T style={[type.bodyStrong, { color: '#fff' }]}>Upload a photo</T>
                  <T style={[type.small, { color: '#ffffffcc' }]}>Crop and zoom it to fit</T>
                </View>
              </Pressable>
              {current.imageUri ? (
                <Pressable onPress={() => onDone({ imageUri: undefined })} style={{ padding: 10, alignItems: 'center' }}>
                  <T style={[type.smallStrong, { color: c.danger }]}>Remove photo</T>
                </Pressable>
              ) : null}
              <T muted style={[type.label, { letterSpacing: 1, marginTop: 8, marginBottom: 8 }]}>OR PICK AN ICON</T>
              <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {defaultLabel ? (
                  <Pressable onPress={() => onDone({ emoji: undefined, imageUri: undefined })} style={[cell, !current.emoji && !current.imageUri ? cellOn : null, { width: 'auto', paddingHorizontal: 12 }]}>
                    <T style={type.smallStrong}>{defaultLabel}</T>
                  </Pressable>
                ) : null}
                {emojiChoices.map((e) => (
                  <Pressable key={e} onPress={() => onDone({ emoji: e, imageUri: undefined })} style={[cell, current.emoji === e && !current.imageUri ? cellOn : null]}>
                    <T style={{ fontSize: 24, lineHeight: 30 }}>{e}</T>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const cell = { width: 48, height: 48, borderRadius: 12, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border } as const;
const cellOn = { borderColor: c.accent, borderWidth: 2 } as const;

function Cropper({ src, onCancel, onSave }: { src: { uri: string; w: number; h: number }; onCancel: () => void; onSave: (uri: string) => void }) {
  const base = FRAME / Math.min(src.w, src.h);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const live = useRef({ zoom, pos });
  live.current = { zoom, pos };

  const clamp = (p: { x: number; y: number }, z: number) => {
    const mx = (src.w * base * z - FRAME) / 2;
    const my = (src.h * base * z - FRAME) / 2;
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = live.current.pos;
        },
        onPanResponderMove: (_e, g) => setPos(clamp({ x: start.current.x + g.dx, y: start.current.y + g.dy }, live.current.zoom)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src],
  );

  const setZ = (z: number) => {
    const nz = Math.max(1, Math.min(4, Math.round(z * 100) / 100));
    setZoom(nz);
    setPos((p) => clamp(p, nz));
  };

  const save = async () => {
    setBusy(true);
    try {
      const s = base * zoom;
      const size = FRAME / s;
      const originX = (src.w * s - FRAME) / 2 / s - pos.x / s;
      const originY = (src.h * s - FRAME) / 2 / s - pos.y / s;
      const out = await ImageManipulator.manipulateAsync(
        src.uri,
        [{ crop: { originX: Math.max(0, originX), originY: Math.max(0, originY), width: Math.min(size, src.w), height: Math.min(size, src.h) } }, { resize: { width: OUT, height: OUT } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      onSave(out.base64 ? `data:image/jpeg;base64,${out.base64}` : out.uri);
    } finally {
      setBusy(false);
    }
  };

  const W = src.w * base * zoom;
  const H = src.h * base * zoom;
  return (
    <View style={{ alignItems: 'center' }}>
      <T style={[type.display24, { alignSelf: 'flex-start', marginBottom: 4 }]}>Crop your photo</T>
      <T muted style={[type.small, { alignSelf: 'flex-start', marginBottom: 12 }]}>Drag to move it. Zoom to fill the square.</T>
      <View {...pan.panHandlers} style={{ width: FRAME, height: FRAME, borderRadius: FRAME * 0.3, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: c.accent }}>
        <Image source={{ uri: src.uri }} style={{ position: 'absolute', width: W, height: H, left: (FRAME - W) / 2 + pos.x, top: (FRAME - H) / 2 + pos.y }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <Pressable onPress={() => setZ(zoom - 0.2)} style={zoomBtn}><T style={type.title}>−</T></Pressable>
        <View style={{ width: 140, height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt }}>
          <View style={{ width: `${((zoom - 1) / 3) * 100}%`, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
        </View>
        <Pressable onPress={() => setZ(zoom + 0.2)} style={zoomBtn}><T style={type.title}>＋</T></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
        <Pressable onPress={onCancel} style={[actBtn, { backgroundColor: c.surfaceAlt }]}><T style={type.bodyStrong}>Back</T></Pressable>
        <Pressable disabled={busy} onPress={save} style={[actBtn, { backgroundColor: c.accent }]}><T style={[type.bodyStrong, { color: c.bg }]}>{busy ? 'Saving…' : 'Use photo'}</T></Pressable>
      </View>
    </View>
  );
}

const zoomBtn = { width: 40, height: 40, borderRadius: 12, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' } as const;
const actBtn = { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' } as const;
