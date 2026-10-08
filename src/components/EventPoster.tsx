import { Image, StyleSheet, View } from 'react-native';

export function EventPoster() {
  return (
    <View style={styles.frame}>
      <Image
        source={require('../../assets/images/juste-debout-paris-2027.jpg')}
        accessibilityLabel="Juste Debout Paris 2027 · 13 & 14 March 2027"
        resizeMode="contain"
        style={styles.poster}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 560, aspectRatio: 1122 / 1402, alignSelf: 'center', marginVertical: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  poster: { width: '100%', height: '100%' },
});
