import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import process from 'process';

global.Buffer = global.Buffer || Buffer;
global.process = global.process || process;

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);