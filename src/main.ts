import './style.css';
import Phaser from 'phaser';
import { gameConfig } from './game/config';

// Phaser mounts into #app (see gameConfig.parent)
new Phaser.Game(gameConfig);
