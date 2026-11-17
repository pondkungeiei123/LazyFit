export type FoodRecognitionResult =
  | { status: 'unavailable' }
  | { status: 'review_required'; candidates: { name: string; catalogId?: string }[] }

export interface FoodRecognitionAdapter {
  // The caller must obtain consent before invoking an adapter that sends images off device.
  readonly processing: 'on_device' | 'external'
  readonly available: boolean
  recognize(image: Blob): Promise<FoodRecognitionResult>
}

export const foodRecognition: FoodRecognitionAdapter = {
  processing: 'on_device',
  available: false,
  async recognize() { return { status: 'unavailable' } },
}

