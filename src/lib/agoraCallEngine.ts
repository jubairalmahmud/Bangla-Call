import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';

export interface AgoraCallState {
  isConnected: boolean;
  channelName: string | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  error: string | null;
}

class AgoraVoiceEngine {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private currentChannel: string | null = null;
  private isJoined = false;

  public onRemoteUserJoined?: (user: IAgoraRTCRemoteUser) => void;
  public onRemoteUserLeft?: (user: IAgoraRTCRemoteUser) => void;
  public onError?: (error: string) => void;

  /**
   * Initialize and Join an Agora Audio Channel
   */
  public async joinAudioChannel(
    appId: string,
    channelName: string,
    uid: string | number,
    token: string | null = null
  ): Promise<boolean> {
    try {
      if (this.isJoined) {
        await this.leaveAudioChannel();
      }

      // Create RTC Client configured for High Definition Audio Call
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Handle Remote Audio Playback automatically
      this.client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        if (!this.client) return;
        await this.client.subscribe(user, mediaType);

        if (mediaType === 'audio' && user.audioTrack) {
          const remoteAudioTrack: IRemoteAudioTrack = user.audioTrack;
          remoteAudioTrack.play();
          console.log(`[Agora Engine] Playing remote audio for user ${user.uid}`);
          if (this.onRemoteUserJoined) this.onRemoteUserJoined(user);
        }
      });

      this.client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        if (mediaType === 'audio') {
          if (this.onRemoteUserLeft) this.onRemoteUserLeft(user);
        }
      });

      this.client.on('user-left', (user: IAgoraRTCRemoteUser) => {
        if (this.onRemoteUserLeft) this.onRemoteUserLeft(user);
      });

      // Fetch dynamic token from backend if not explicitly provided
      let activeToken = token;
      let targetAppId = appId;
      if (!activeToken) {
        try {
          const res = await fetch(`/api/agora/token?channelName=${encodeURIComponent(channelName)}&account=${encodeURIComponent(uid)}`);
          const data = await res.json();
          if (data && data.success) {
            if (data.token) activeToken = data.token;
            if (data.appId) targetAppId = data.appId;
          }
        } catch (e) {
          console.warn('[Agora Engine] Fetch token warning:', e);
        }
      }

      // Join Channel
      console.log(`[Agora Engine] Joining channel: ${channelName} with AppID: ${targetAppId}`);
      await this.client.join(targetAppId, channelName, activeToken || null, uid);
      this.currentChannel = channelName;
      this.isJoined = true;

      // Create & Publish Local Microphone Audio Track
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Automatic Noise Suppression
        AGC: true, // Automatic Gain Control
      });

      await this.client.publish([this.localAudioTrack]);
      console.log(`[Agora Engine] Microphone track published successfully to channel: ${channelName}`);
      return true;
    } catch (err: any) {
      console.error('[Agora Engine] Join Error:', err);
      const errorMessage = err?.message || 'Agora সংযোগ তৈরি করতে ব্যর্থ হয়েছে';
      if (this.onError) this.onError(errorMessage);
      return false;
    }
  }

  /**
   * Mute / Unmute Local Microphone
   */
  public async setMuted(muted: boolean): Promise<void> {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setMuted(muted);
    }
  }

  /**
   * Leave Audio Channel & Clean up media tracks
   */
  public async leaveAudioChannel(): Promise<void> {
    try {
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }

      if (this.client && this.isJoined) {
        await this.client.leave();
        this.client.removeAllListeners();
      }
    } catch (err) {
      console.error('[Agora Engine] Leave Error:', err);
    } finally {
      this.client = null;
      this.currentChannel = null;
      this.isJoined = false;
    }
  }

  public getChannelName(): string | null {
    return this.currentChannel;
  }

  public getIsJoined(): boolean {
    return this.isJoined;
  }
}

export const agoraVoiceEngine = new AgoraVoiceEngine();
