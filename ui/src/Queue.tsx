import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";
import { ISettings } from "./Settings";
import Track, { ITrackProps } from "./Track";

export interface IQueuedItem {
  id: string;
  track: ITrackProps;
  userId: string;
  votes: IVote[];
  protected: boolean;
  source: "spotify" | "youtube";
  playlistTrack: boolean;
}

export interface IVote {
  userId: string;
  value: number;
}

interface IQueueProps {
  onQueued: () => void;
  onError: (msg: string) => void;
  onSkip: () => void;
  onRemove: () => void;
  onProtected: () => void;
  onToggleFromFavorites: (trackId: string, source: string, isFavorite: boolean) => void;
  queue: IQueuedItem[] | null;
  currentTrack: IQueuedItem | null;
  settings: ISettings | null;
  user: IUser | null;
  isOwner: boolean;
}

interface IQueueState {
  contextMenuId: string | null;
  contextMenuTrack: IQueuedItem | null;
  contextMenuTargetPlaying: boolean;
}

export class Queue extends React.Component<IQueueProps, IQueueState> {

  public constructor(props: IQueueProps) {
    super(props);

    this.state = {
      contextMenuId: null,
      contextMenuTrack: null,
      contextMenuTargetPlaying: false,
    };

    this.removeFromQueue = this.removeFromQueue.bind(this);
    this.showContextMenu = this.showContextMenu.bind(this);
    this.protectTrack = this.protectTrack.bind(this);
    this.hideMenu = this.hideMenu.bind(this);
    this.moveUp = this.moveUp.bind(this);
    this.calculateProtectCost = this.calculateProtectCost.bind(this);
  }

  protected renderCurrentTrack() {
    if (!this.props.currentTrack) {
      return null;
    }
    return (
      <li key="currentTrack">
        <div className="dropup">
          <Track
            name={this.props.currentTrack.track.name}
            artist={this.props.currentTrack.track.artist}
            id={this.props.currentTrack.id}
            trackId={this.props.currentTrack.track.id}
            artistId={this.props.currentTrack.track.artistId}
            duration={this.props.currentTrack.track.duration}
            key={"current-" + this.props.currentTrack.track.id}
            isPlaying={true}
            source={this.props.currentTrack.source}
            protectedTrack={this.props.currentTrack.protected}
            owned={this.props.user!.id === this.props.currentTrack.userId}
            isFavorite={this.props.currentTrack.track.isFavorite}
            selectTrack={this.showContextMenu}
            toggleFromFavorites={this.props.onToggleFromFavorites} />
          <div className={"dropdown-menu " + (this.state.contextMenuId === this.props.currentTrack.id ? "show" : "hide")} aria-labelledby="deviceMenuButton">
            {this.renderContextMenu()}
          </div>
        </div>
      </li>
    );
  }

  protected removeFromQueue(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    axios.delete(config.backend.url + "/removeFromQueue", {
      data: {
        trackId: this.state.contextMenuTrack!.id,
        isPlaying: this.state.contextMenuTargetPlaying
      }
    }).then(() => {
      if (this.state.contextMenuTargetPlaying) {
        this.props.onSkip();
      } else {
        this.props.onRemove();
      }
      this.setState({
        contextMenuId: null,
        contextMenuTrack: null,
        contextMenuTargetPlaying: false
      });
    }).catch(err => {
      this.props.onError(err.response.data.message);
    });
  }

  protected protectTrack(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    axios.post(config.backend.url + "/protectTrack", {
      trackId: this.state.contextMenuTrack!.id,
      isPlaying: this.state.contextMenuTargetPlaying
    }).then(() => {
      this.props.onProtected();
      this.setState({
        contextMenuId: null,
        contextMenuTrack: null,
        contextMenuTargetPlaying: false
      });
    }).catch(err => {
      this.props.onError(err.response.data.message);
    });
  }

  protected moveUp(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    axios.post(config.backend.url + "/moveUpInQueue", {
      trackId: this.state.contextMenuTrack!.id
    }).then(() => {
      this.props.onQueued();
      this.setState({
        contextMenuId: null,
        contextMenuTrack: null,
        contextMenuTargetPlaying: false
      });
    }).catch(err => {
      this.props.onError(err.response.data.message);
    });
  }

  protected renderContextMenu() {
    if (!this.state.contextMenuTrack) {
      return null;
    }

    const menu = [];

    const playlistTrackForOwner = this.state.contextMenuTrack.playlistTrack && this.props.isOwner;
    const skipCost = this.calculateSkipCost(this.state.contextMenuTrack.track);
    const showPoints =
      (this.props.settings!.gamify && this.state.contextMenuTrack.userId !== this.props.user!.id && !playlistTrackForOwner)
        ? "(-" + skipCost + " pts)"
        : "";
    if (this.props.settings!.gamify || this.state.contextMenuTrack.userId === this.props.user!.id || playlistTrackForOwner) {
      if (!this.state.contextMenuTargetPlaying) {
        menu.push(
          <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
            <FontAwesomeIcon icon="trash-alt" /> Remove from queue {showPoints}
          </a>
        );
        if (this.props.settings && this.props.settings.gamify) {
          menu.push(
            <a className={"dropdown-item"} key={"moveUp"} href="#" onClick={this.moveUp}>
              <FontAwesomeIcon icon="arrow-circle-up" /> Move up in queue (-5 pts)
                        </a>
          );
        }
      } else {
        menu.push(
          <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
            <FontAwesomeIcon icon="forward" /> Skip {showPoints}
          </a>
        );
      }
    }

    // If gamify enabled
    if (this.props.settings
      && this.props.settings.gamify
      && !this.state.contextMenuTrack.protected) {
      const protectCost = this.calculateProtectCost(this.state.contextMenuTrack.track);
      menu.push(
        <a className={"dropdown-item"} key={"protectTrack"} href="#" onClick={this.protectTrack}>
          <FontAwesomeIcon icon="shield-alt" /> Protect from skip (-{protectCost} pts)
                </a>
      );
    }

    if (menu.length === 0) {
      this.hideMenu();
    }

    return menu;
  }
  protected showContextMenu(targetId: string, isPlaying: boolean) {
    const track: IQueuedItem = (!isPlaying)
      ? this.props.queue!.find(q => q.id === targetId)!
      : this.props.currentTrack!;
    this.setState(() => ({
      contextMenuId: targetId,
      contextMenuTrack: track,
      contextMenuTargetPlaying: isPlaying,
    }));
  }
  protected hideMenu() {
    this.setState(() => ({
      contextMenuId: null,
      contextMenuTrack: null,
      contextMenuTargetPlaying: false
    }));
  }

  protected renderTracks() {
    if (!this.props.queue) {
      return null;
    }

    const progress = this.props.currentTrack && this.props.currentTrack.track.progress ? this.props.currentTrack.track.progress : 0;
    let totalDuration = this.props.currentTrack ? this.props.currentTrack.track.duration - progress : 0;
    return this.props.queue.map((queuedItem, i) => {
      const element = <li className="queuedTrack" key={"queue-" + i}>
        <div className="dropup">
          <Track
            name={queuedItem.track.name}
            artist={queuedItem.track.artist}
            id={queuedItem.id}
            trackId={queuedItem.track.id}
            artistId={queuedItem.track.artistId}
            duration={queuedItem.track.duration}
            key={i + "-" + queuedItem.track.id}
            isPlaying={false}
            source={queuedItem.source}
            protectedTrack={queuedItem.protected}
            owned={queuedItem.userId === this.props.user!.id}
            isFavorite={queuedItem.track.isFavorite}
            selectTrack={this.showContextMenu}
            totalDuration={totalDuration}
            toggleFromFavorites={this.props.onToggleFromFavorites} />
        </div>
        <div className={"dropdown-menu " + (this.state.contextMenuId === queuedItem.id ? "show" : "hide")} aria-labelledby="deviceMenuButton">
          {this.renderContextMenu()}
        </div>
      </li>;
      totalDuration += queuedItem.track.duration;
      return element;
    });
  }

  public render() {
    return (
      <div className="queue">
        <ol className={"queuedTracks " + (this.props.settings && this.props.settings.randomQueue ? "randomQueue" : "")}>
          {this.renderCurrentTrack()}
          {this.renderTracks()}
        </ol>
        <div className={"menuOverlay " + (this.state.contextMenuId ? "visible" : "hidden")} onClick={this.hideMenu} />
      </div>
    );
  }

  private calculateProtectCost(track: ITrackProps) {
    const millisLeft = track.duration - (track.progress || 0);
    const minutesLeft = Math.floor(millisLeft / 60000);
    return (minutesLeft + 1) * 5;
  }
  private calculateSkipCost(track: ITrackProps) {
    const millisLeft = track.duration - (track.progress || 0);
    const minutesLeft = Math.floor(millisLeft / 60000);
    return (minutesLeft + 1) * 5;
  }
}
