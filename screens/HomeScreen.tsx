import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { toast } from 'sonner-native';

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<any>(null);
  
  // Pick an image from gallery
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
      setAnalysis(null); // Reset previous analysis
    }
  };

  // Take a photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      toast.error('Camera permission is required to take photos');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
      setAnalysis(null); // Reset previous analysis
    }
  };

  // Analyze the chart image
  const analyzeChart = async () => {
    if (!image) {
      toast.error('Please upload or take a chart image first');
      return;
    }

    setLoading(true);

    try {
      // Mock image to base64 conversion
      // In a real app, you'd convert the image file to base64
      
      // Call the AI LLM API to analyze the chart
      const response = await fetch('https://api.a0.dev/ai/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are an expert stock chart analyzer. Analyze the provided chart and give trading recommendations based on technical indicators."
            },
            {
              role: "user",
              content: "Analyze this stock chart and tell me if I should go long or short. Include analysis of RSI, MACD, and other relevant indicators on different timeframes."
            }
          ]
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      // Mock analysis result for demo purposes
      // In production, you'd use the actual API response
      setAnalysis({
        recommendation: Math.random() > 0.5 ? 'LONG' : 'SHORT',
        confidence: Math.floor(Math.random() * 30) + 70, // 70-99%
        timeframe: '4H',
        indicators: {
          rsi: {
            value: Math.floor(Math.random() * 100),
            interpretation: Math.random() > 0.5 ? 'Overbought' : 'Oversold'
          },
          macd: {
            signal: Math.random() > 0.5 ? 'Bullish Crossover' : 'Bearish Crossover',
            histogram: Math.random() > 0.5 ? 'Positive' : 'Negative'
          },
          movingAverages: {
            trend: Math.random() > 0.5 ? 'Upward' : 'Downward',
            crosses: Math.random() > 0.5 ? 'Golden Cross' : 'Death Cross'
          }
        },
        additionalRecommendations: "Consider setting a stop loss at key support level. Volume appears to confirm the trend."
      });
      
    } catch (error) {
      console.error('Error analyzing chart:', error);
      toast.error('Failed to analyze chart');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>TradingAI Advisor</Text>
          <Text style={styles.subtitle}>Upload chart images for AI analysis</Text>
        </View>
        
        {!image ? (
          <View style={styles.placeholderContainer}>
            <Image
              source={{ uri: 'https://api.a0.dev/assets/image?text=Upload Chart&aspect=4:3&seed=stocks' }}
              style={styles.placeholderImage}
            />
            <Text style={styles.placeholderText}>
              Upload or take a photo of a stock chart to get started
            </Text>
          </View>
        ) : (
          <Image source={{ uri: image }} style={styles.chartImage} />
        )}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <MaterialCommunityIcons name="file-upload" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Upload Chart</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {image && !loading && !analysis && (
          <TouchableOpacity style={styles.analyzeButton} onPress={analyzeChart}>
            <FontAwesome5 name="chart-line" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Analyze Chart</Text>
          </TouchableOpacity>
        )}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Analyzing chart indicators...</Text>
          </View>
        )}
        
        {analysis && (
          <View style={styles.analysisContainer}>
            <View style={[
              styles.recommendationBanner, 
              analysis.recommendation === 'LONG' ? styles.longBanner : styles.shortBanner
            ]}>
              <Text style={styles.recommendationText}>
                {analysis.recommendation === 'LONG' ? 'BUY / LONG' : 'SELL / SHORT'}
              </Text>
              <Text style={styles.confidenceText}>
                {analysis.confidence}% Confidence
              </Text>
            </View>
            
            <View style={styles.timeframeContainer}>
              <Text style={styles.timeframeLabel}>Timeframe:</Text>
              <View style={styles.timeframeBox}>
                <Text style={styles.timeframeText}>{analysis.timeframe}</Text>
              </View>
            </View>
            
            <View style={styles.indicatorSection}>
              <Text style={styles.sectionTitle}>Technical Indicators</Text>
              
              <View style={styles.indicator}>
                <View style={styles.indicatorHeader}>
                  <Text style={styles.indicatorName}>RSI</Text>
                  <View style={[
                    styles.valuePill, 
                    analysis.indicators.rsi.interpretation === 'Overbought' ? styles.overboughtPill : styles.oversoldPill
                  ]}>
                    <Text style={styles.pillText}>{analysis.indicators.rsi.value}</Text>
                  </View>
                </View>
                <Text style={styles.indicatorValue}>{analysis.indicators.rsi.interpretation}</Text>
              </View>
              
              <View style={styles.indicator}>
                <View style={styles.indicatorHeader}>
                  <Text style={styles.indicatorName}>MACD</Text>
                </View>
                <Text style={styles.indicatorValue}>Signal: {analysis.indicators.macd.signal}</Text>
                <Text style={styles.indicatorValue}>Histogram: {analysis.indicators.macd.histogram}</Text>
              </View>
              
              <View style={styles.indicator}>
                <View style={styles.indicatorHeader}>
                  <Text style={styles.indicatorName}>Moving Averages</Text>
                </View>
                <Text style={styles.indicatorValue}>Trend: {analysis.indicators.movingAverages.trend}</Text>
                <Text style={styles.indicatorValue}>Signal: {analysis.indicators.movingAverages.crosses}</Text>
              </View>
            </View>
            
            <View style={styles.additionalInfoContainer}>
              <Text style={styles.sectionTitle}>Additional Recommendations</Text>
              <Text style={styles.additionalInfo}>{analysis.additionalRecommendations}</Text>
            </View>
            
            <Text style={styles.disclaimer}>
              Disclaimer: This is not financial advice. Always conduct your own research before making trading decisions.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  placeholderContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  placeholderText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6B7280',
    paddingHorizontal: 20,
  },
  chartImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.48,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  analyzeButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4B5563',
  },
  analysisContainer: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }
    }),
  },
  recommendationBanner: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  longBanner: {
    backgroundColor: '#10B981',
  },
  shortBanner: {
    backgroundColor: '#EF4444',
  },
  recommendationText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  confidenceText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  timeframeContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeframeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  timeframeBox: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  indicatorSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  indicator: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  indicatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  indicatorValue: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  valuePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  overboughtPill: {
    backgroundColor: '#FEE2E2',
  },
  oversoldPill: {
    backgroundColor: '#D1FAE5',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  additionalInfoContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  additionalInfo: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 16,
    fontStyle: 'italic',
  },
});